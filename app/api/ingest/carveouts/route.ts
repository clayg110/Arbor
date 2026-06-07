import { NextResponse, type NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { extractSignal } from "@/lib/extract-signal";
import { fetchRecentCarveoutFilings } from "@/lib/ingest/edgar";
import { fetchUniverseSignals, markUniverseScanned } from "@/lib/ingest/universe";
import { fetchTranscriptSignals, hasTranscriptEnv } from "@/lib/ingest/transcripts";
import { processSignal, type Outcome } from "@/lib/ingest/persist";
import { cronGuard } from "@/lib/ingest/guard";
import { acquireLock } from "@/lib/redis/lock";
import { notifyPipelineFailure, notifyPipelineCrash } from "@/lib/alerts";

export const maxDuration = 60;

// Carveout pipeline — SEC EDGAR → extract → resolve → update. Runs every 6h
// (vercel.json) or via the /admin manual trigger.
async function run(request: NextRequest) {
  const guard = cronGuard(request);
  if (guard) return guard;

  const lock = await acquireLock("arbor:ingest:carveouts");
  if (!lock) {
    return NextResponse.json({ ok: false, error: "Already running" }, { status: 409 });
  }

  try {
    const filings = await fetchRecentCarveoutFilings();
    const svc = createServiceClient();

    const counts: Record<Outcome | "errors" | "fetched", number> = {
      fetched: filings.length,
      skipped: 0,
      matched_nochange: 0,
      updated: 0,
      flagged: 0,
      created: 0,
      errors: 0,
    };

    for (const f of filings) {
      try {
        const ex = await extractSignal({ rawText: f.rawText, sourceType: "sec_filing" });
        if (!ex) {
          counts.errors++;
          continue;
        }
        const r = await processSignal(
          svc,
          ex,
          {
            sourceType: "sec_filing",
            sourceName: f.sourceName,
            docType: f.docType,
            sourceUrl: f.sourceUrl,
            rawText: f.rawText,
          },
          "carveout"
        );
        counts[r.outcome]++;
      } catch {
        counts.errors++;
      }
    }

    // Universe monitoring: scan least-recently-scanned §2.1 companies for
    // divestiture news (Google CSE; no-op without Google env).
    const { signals: uni, scannedIds } = await fetchUniverseSignals(svc, 20, 2);
    for (const s of uni) {
      try {
        const ex = await extractSignal({ rawText: s.rawText, sourceType: "google_news" });
        if (!ex) {
          counts.errors++;
          continue;
        }
        const r = await processSignal(
          svc,
          ex,
          {
            sourceType: "google_news",
            sourceName: s.sourceName,
            docType: s.docType,
            sourceUrl: s.sourceUrl,
            rawText: s.rawText,
          },
          "carveout"
        );
        counts[r.outcome]++;
      } catch {
        counts.errors++;
      }
    }
    await markUniverseScanned(svc, scannedIds);

    // Earnings-call transcripts: parent companies often disclose divestitures
    // on the call (FMP; no-op without FMP_API_KEY + TRANSCRIPT_TICKERS).
    let transcripts = 0;
    if (hasTranscriptEnv()) {
      const items = await fetchTranscriptSignals(10);
      transcripts = items.length;
      counts.fetched += items.length;
      for (const t of items) {
        try {
          const ex = await extractSignal({ rawText: t.rawText, sourceType: "earnings_transcript" });
          if (!ex) {
            counts.errors++;
            continue;
          }
          const r = await processSignal(
            svc,
            ex,
            {
              sourceType: "earnings_transcript",
              sourceName: t.sourceName,
              docType: t.docType,
              sourceUrl: t.sourceUrl,
              rawText: t.rawText,
            },
            "carveout"
          );
          counts[r.outcome]++;
        } catch {
          counts.errors++;
        }
      }
    }

    await svc.from("pipeline_runs").insert({
      pipeline: "carveouts",
      fetched: counts.fetched,
      created: counts.created,
      updated: counts.updated,
      flagged: counts.flagged,
      errors: counts.errors,
      ok: counts.errors === 0,
    });

    await notifyPipelineFailure({ pipeline: "carveouts", ...counts });

    return NextResponse.json({
      ok: true,
      pipeline: "carveouts",
      universeScanned: scannedIds.length,
      transcripts,
      ...counts,
    });
  } catch (err) {
    try {
      await createServiceClient()
        .from("pipeline_runs")
        .insert({ pipeline: "carveouts", fetched: 0, created: 0, updated: 0, flagged: 0, errors: 1, ok: false });
    } catch {
      // recording the failure is best-effort
    }
    await notifyPipelineCrash("carveouts", err);
    return NextResponse.json({ ok: false, error: "Pipeline crashed" }, { status: 500 });
  } finally {
    await lock.release();
  }
}

export const GET = run;
export const POST = run;
