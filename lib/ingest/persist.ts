// Persist an extracted signal: write signals_raw, then resolve → update stage
// (+ history) on match, or create a needs_review company on miss.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, LlmOutput, DbFeedEvent, DbCompany } from "@/types/db";
import type { Stage, SourceType, Confidence } from "@/lib/types";
import type { ExtractedSignal } from "@/lib/extract-signal";
import { resolveCompany } from "./resolve";
import { fetchLogoUrl } from "./logo";
import { dedupeKey } from "@/lib/dedupe";
import { corroboratedConfidence, distinctSourceCount } from "@/lib/corroboration";

const CORROBORATION_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

type Svc = SupabaseClient<Database>;

export interface SignalMeta {
  sourceType: SourceType;
  sourceName: string;
  docType: string;
  sourceUrl: string;
  rawText: string;
}

export type Outcome = "skipped" | "matched_nochange" | "updated" | "flagged" | "created";
export interface ProcessResult {
  outcome: Outcome;
  companyId?: string;
}

const STAGE_EVENT: Record<Stage, DbFeedEvent> = {
  in_market: "moved_in_market",
  monitor_for_exit: "moved_monitor",
  on_hold: "moved_on_hold",
  pulled: "pulled",
};

function toLlmOutput(ex: ExtractedSignal): LlmOutput {
  return {
    stage: ex.stage,
    confidence: ex.confidence,
    key_quote: ex.key_quote,
    reasoning: ex.reasoning,
    headline: ex.key_quote,
    deal_size: ex.deal_size,
  };
}

// Financials extracted from the source → company columns (+ source links).
function financialFields(ex: ExtractedSignal, meta: SignalMeta): Partial<DbCompany> {
  const f: Partial<DbCompany> = {};
  if (ex.revenue) {
    f.revenue = ex.revenue;
    f.revenue_source_url = meta.sourceUrl;
  }
  if (ex.ebitda) {
    f.ebitda = ex.ebitda;
    f.ebitda_source_url = meta.sourceUrl;
  }
  if (ex.margin) f.margin = ex.margin;
  return f;
}

async function insertSignal(
  svc: Svc,
  companyId: string | null,
  meta: SignalMeta,
  llm: LlmOutput
): Promise<string | null> {
  // Upsert-ignore on the dedupe key: a re-ingested (url, text) pair is a no-op
  // instead of a duplicate row. A conflict returns no row → null id (the caller
  // then writes history with a null signal_id, which is fine).
  const { data } = await svc
    .from("signals_raw")
    .upsert(
      {
        company_id: companyId,
        raw_text: meta.rawText.slice(0, 8000),
        source_url: meta.sourceUrl,
        source_type: meta.sourceType,
        source_name: meta.sourceName,
        doc_type: meta.docType,
        processed: true,
        matched_company_id: companyId,
        llm_output: llm,
        dedupe_key: dedupeKey(meta.sourceUrl, meta.rawText),
      },
      { onConflict: "dedupe_key", ignoreDuplicates: true }
    )
    .select("id")
    .maybeSingle();
  return data?.id ?? null;
}

export async function processSignal(
  svc: Svc,
  ex: ExtractedSignal,
  meta: SignalMeta,
  pipelineDeal: "carveout" | "private_asset"
): Promise<ProcessResult> {
  const llm = toLlmOutput(ex);
  const fin = financialFields(ex, meta);

  if (!ex.found || !ex.company_name) {
    await insertSignal(svc, null, meta, llm);
    return { outcome: "skipped" };
  }

  const match = await resolveCompany(svc, ex.company_name);
  const lowConf = ex.confidence === "low" || ex.confidence === "needs_review";

  if (match) {
    const { data: co } = await svc
      .from("companies")
      .select("*")
      .eq("id", match.id)
      .maybeSingle();
    const sigId = await insertSignal(svc, match.id, meta, llm);
    if (!co) return { outcome: "skipped", companyId: match.id };

    // Multi-source corroboration: count distinct source types backing this
    // company in the 30-day window (incl. the signal just inserted). When ≥3
    // independent sources agree, auto-promote confidence to high — strong enough
    // to override a single low-quality signal's flag.
    const cutoff = new Date(Date.now() - CORROBORATION_WINDOW_MS).toISOString();
    const { data: recentRows } = await svc
      .from("signals_raw")
      .select("source_type")
      .eq("company_id", match.id)
      .gte("ingested_at", cutoff);
    const bump = corroboratedConfidence(
      co.confidence as Confidence,
      distinctSourceCount((recentRows ?? []) as { source_type: SourceType | null }[])
    );

    // Low-confidence signal → flag for analyst (no stage change), unless
    // independent corroboration promotes it to high.
    if (lowConf) {
      await svc
        .from("companies")
        .update({ confidence: bump ?? "needs_review", ...fin })
        .eq("id", match.id);
      return { outcome: bump ? "updated" : "flagged", companyId: match.id };
    }

    if (ex.stage && ex.stage !== co.current_stage) {
      await svc
        .from("companies")
        .update({
          current_stage: ex.stage,
          confidence: bump ?? ex.confidence ?? co.confidence,
          ...fin,
        })
        .eq("id", match.id);
      await svc.from("deal_stage_history").insert({
        company_id: match.id,
        signal_id: sigId,
        stage: ex.stage,
        event_type: STAGE_EVENT[ex.stage],
        changed_by: "system_auto",
        source_type: meta.sourceType,
        source_name: meta.sourceName,
        doc_type: meta.docType,
        source_url: meta.sourceUrl,
        headline: ex.key_quote ?? ex.reasoning ?? null,
      });
      return { outcome: "updated", companyId: match.id };
    }

    // No stage change. Apply a corroboration bump and/or financial enrichment.
    if (bump || Object.keys(fin).length > 0) {
      await svc
        .from("companies")
        .update({ ...(bump ? { confidence: bump } : {}), ...fin })
        .eq("id", match.id);
    }
    return {
      outcome: bump ? "updated" : "matched_nochange",
      companyId: match.id,
    };
  }

  // No match → create a needs_review company. Best-effort logo enrichment
  // (null on miss → initials placeholder in the UI).
  const stage: Stage = ex.stage ?? "in_market";
  const logoUrl = await fetchLogoUrl(ex.company_name);
  const { data: created } = await svc
    .from("companies")
    .insert({
      name: ex.company_name,
      sector: ex.sector ?? "chemicals",
      deal_type: ex.deal_type ?? pipelineDeal,
      parent_company: ex.parent_company ?? null,
      sponsor_firm: ex.sponsor_firm ?? null,
      confidence: "needs_review",
      current_stage: stage,
      logo_url: logoUrl,
      ...fin,
    })
    .select("id")
    .single();

  const newId = created?.id;
  if (!newId) return { outcome: "skipped" };

  const sigId = await insertSignal(svc, newId, meta, llm);
  await svc.from("deal_stage_history").insert({
    company_id: newId,
    signal_id: sigId,
    stage,
    event_type: "new_entry",
    changed_by: "system_auto",
    source_type: meta.sourceType,
    source_name: meta.sourceName,
    doc_type: meta.docType,
    source_url: meta.sourceUrl,
    headline: ex.key_quote ?? `Added to tracker — ${ex.company_name}`,
  });

  return { outcome: "created", companyId: newId };
}
