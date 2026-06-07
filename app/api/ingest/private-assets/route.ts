import { NextResponse, type NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { extractSignal } from "@/lib/extract-signal";
import { fetchCompanyWebSignals, hasGoogleEnv } from "@/lib/ingest/google";
import { fetchRssSignals } from "@/lib/ingest/rss";
import { processSignal, type Outcome } from "@/lib/ingest/persist";
import { cronGuard } from "@/lib/ingest/guard";
import { acquireLock } from "@/lib/redis/lock";
import { notifyPipelineFailure, notifyPipelineCrash } from "@/lib/alerts";

export const maxDuration = 60;

const COMPANY_LIMIT = 25; // bound LLM cost per run
const RESULTS_PER_COMPANY = 3;
const RSS_PER_FEED = 10;

// Private-asset pipeline — Google CSE per tracked company (if configured) +
// PE/M&A RSS. Runs every 12h or via the /admin manual trigger.
async function run(request: NextRequest) {
  const guard = cronGuard(request);
  if (guard) return guard;

  const lock = await acquireLock("arbor:ingest:private-assets");
  if (!lock) {
    return NextResponse.json({ ok: false, error: "Already running" }, { status: 409 });
  }

  try {
  const svc = createServiceClient();

  const counts: Record<Outcome | "errors" | "scanned", number> = {
    scanned: 0,
    skipped: 0,
    matched_nochange: 0,
    updated: 0,
    flagged: 0,
    created: 0,
    errors: 0,
  };

  const process = async (
    rawText: string,
    source: "google_news" | "rss_feed",
    sourceName: string,
    docType: string,
    sourceUrl: string
  ) => {
    counts.scanned++;
    try {
      const ex = await extractSignal({ rawText, sourceType: source });
      if (!ex) {
        counts.errors++;
        return;
      }
      const r = await processSignal(
        svc,
        ex,
        { sourceType: source, sourceName, docType, sourceUrl, rawText },
        "private_asset"
      );
      counts[r.outcome]++;
    } catch {
      counts.errors++;
    }
  };

  // 1) Google CSE per tracked private-asset company.
  if (hasGoogleEnv()) {
    const { data: companies } = await svc
      .from("companies")
      .select("id,name")
      .eq("deal_type", "private_asset")
      .in("current_stage", ["in_market", "monitor_for_exit"])
      .limit(COMPANY_LIMIT);

    for (const c of companies ?? []) {
      const signals = await fetchCompanyWebSignals(c.name, RESULTS_PER_COMPANY);
      for (const s of signals) {
        await process(s.rawText, "google_news", s.sourceName, s.docType, s.sourceUrl);
      }
    }
  }

  // 2) PE / M&A RSS (general exit signals).
  const rss = await fetchRssSignals(RSS_PER_FEED);
  for (const item of rss) {
    await process(item.rawText, "rss_feed", item.sourceName, item.docType, item.sourceUrl);
  }

  await svc.from("pipeline_runs").insert({
    pipeline: "private-assets",
    fetched: counts.scanned,
    created: counts.created,
    updated: counts.updated,
    flagged: counts.flagged,
    errors: counts.errors,
    ok: counts.errors === 0,
  });

  await notifyPipelineFailure({
    pipeline: "private-assets",
    fetched: counts.scanned,
    created: counts.created,
    updated: counts.updated,
    flagged: counts.flagged,
    errors: counts.errors,
  });

  return NextResponse.json({
    ok: true,
    pipeline: "private-assets",
    google: hasGoogleEnv(),
    rssItems: rss.length,
    ...counts,
  });
  } catch (err) {
    try {
      await createServiceClient()
        .from("pipeline_runs")
        .insert({ pipeline: "private-assets", fetched: 0, created: 0, updated: 0, flagged: 0, errors: 1, ok: false });
    } catch {
      // recording the failure is best-effort
    }
    await notifyPipelineCrash("private-assets", err);
    return NextResponse.json({ ok: false, error: "Pipeline crashed" }, { status: 500 });
  } finally {
    await lock.release();
  }
}

export const GET = run;
export const POST = run;
