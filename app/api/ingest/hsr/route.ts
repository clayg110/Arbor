import { NextResponse, type NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { fetchHsrFilings, hasHsrEnv } from "@/lib/ingest/hsr";
import { resolveCompany } from "@/lib/ingest/resolve";
import { cronGuard } from "@/lib/ingest/guard";
import { dedupeKey } from "@/lib/dedupe";
import { captureException } from "@/lib/observability";
import { notifyPipelineCrash } from "@/lib/alerts";

export const maxDuration = 60;

// HSR pipeline — FTC public data → resolve acquirer/target → bump confidence.
// Distinct from the LLM pipeline: data is already structured, so we skip
// processItem and write directly. Any matched company is forced to confidence
// "high" and stage "in_market" (HSR = legally certain transaction ≥$119M).
async function run(request: NextRequest) {
  const guard = cronGuard(request);
  if (guard) return guard;

  if (!hasHsrEnv()) {
    return NextResponse.json({ ok: true, skipped: "HSR_SOURCE_URL not set" });
  }

  const counts = { fetched: 0, matched: 0, skipped: 0, errors: 0 };

  try {
    const filings = await fetchHsrFilings(30);
    counts.fetched = filings.length;

    const svc = createServiceClient();

    for (const filing of filings) {
      try {
        // Try target first (the company being sold), then acquirer.
        const match =
          (await resolveCompany(svc, filing.target)) ??
          (filing.acquirer ? await resolveCompany(svc, filing.acquirer) : null);

        if (!match) {
          counts.skipped++;
          continue;
        }

        const companyId = match.id;
        const rawText = [
          `HSR Filing — Transaction: ${filing.transactionId}`,
          filing.acquirer ? `Acquirer: ${filing.acquirer}` : "",
          `Target: ${filing.target}`,
          `Filed: ${filing.filedDate}`,
        ]
          .filter(Boolean)
          .join("\n");

        // Insert signal (idempotent via dedupe_key).
        await svc.from("signals_raw").upsert(
          {
            company_id: companyId,
            raw_text: rawText,
            source_url: filing.sourceUrl,
            source_type: "hsr_filing",
            source_name: "FTC HSR Program",
            doc_type: "hsr_filing",
            processed: true,
            matched_company_id: companyId,
            llm_output: {
              stage: "in_market",
              confidence: "high",
              key_quote: `HSR filing confirms transaction involving ${filing.target}`,
              reasoning:
                "HSR pre-merger notification is legally required for transactions ≥$119M — highest-confidence deal signal.",
              headline: `HSR pre-merger filing: ${filing.target}`,
              deal_size: undefined,
            },
            dedupe_key: dedupeKey(filing.sourceUrl, rawText),
          },
          { onConflict: "dedupe_key", ignoreDuplicates: true }
        );

        // Force company to in_market + high confidence.
        const { data: co } = await svc
          .from("companies")
          .select("current_stage,confidence")
          .eq("id", companyId)
          .single();

        const alreadyInMarket = co?.current_stage === "in_market";
        const alreadyHigh = co?.confidence === "high";

        await svc
          .from("companies")
          .update({
            confidence: "high",
            current_stage: "in_market",
            updated_at: new Date().toISOString(),
          })
          .eq("id", companyId);

        // History: only insert if something actually changed.
        if (!alreadyInMarket || !alreadyHigh) {
          await svc.from("deal_stage_history").insert({
            company_id: companyId,
            stage: "in_market",
            changed_by: "system_auto",
            source_type: "hsr_filing",
            source_url: filing.sourceUrl,
            event_type: "hsr_filed",
            notes: `HSR pre-merger filing detected. Acquirer: ${filing.acquirer || "unknown"}.`,
          });
        }

        counts.matched++;
      } catch (err) {
        captureException(err, { filing: filing.transactionId });
        counts.errors++;
      }
    }

    await svc.from("pipeline_runs").insert({
      pipeline: "hsr",
      fetched: counts.fetched,
      created: 0,
      updated: counts.matched,
      flagged: 0,
      errors: counts.errors,
      ok: counts.errors === 0,
    });

    return NextResponse.json({ ok: true, pipeline: "hsr", ...counts });
  } catch (err) {
    try {
      await createServiceClient().from("pipeline_runs").insert({
        pipeline: "hsr",
        fetched: 0,
        created: 0,
        updated: 0,
        flagged: 0,
        errors: 1,
        ok: false,
      });
    } catch {
      // best-effort
    }
    captureException(err, { pipeline: "hsr" });
    await notifyPipelineCrash("hsr", err);
    return NextResponse.json({ ok: false, error: "Pipeline crashed" }, { status: 500 });
  }
}

export const GET = run;
export const POST = run;
