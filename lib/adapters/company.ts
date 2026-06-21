// DB rows → company-facing frontend shapes (radar card, profile, history,
// signals, notes). Pure — no Supabase imports.

import type { DbCompany, DbSignal, DbHistory, DbNote, LastSignalRow } from "@/types/db";
import type { RadarCompany, LastSignal } from "@/lib/radar-data";
import type { Company, StageHistoryRecord, Signal, Note } from "@/lib/types";
import { computeConviction } from "@/lib/conviction";
import { computeMarketTiming } from "@/lib/predict-market";
import { daysSince, stageDaysLabel, relativeLabel, shortDate, initialsOf } from "./time";

// Per-company signal aggregates (from v_company_conviction) that sharpen the
// conviction score. Optional — without them the score falls back to last-signal
// recency + confidence + stage.
export interface ConvictionAgg {
  signalCount30d: number;
  distinctSourceTypes: number;
}

function ownerName(c: DbCompany): string {
  return c.sponsor_firm ?? c.parent_company ?? "Undisclosed";
}

function lastSignalFrom(sig: DbSignal | LastSignalRow | null): LastSignal {
  if (!sig) {
    return { label: "no signals yet", sourceName: "—", source: "manual", daysAgo: 99999 };
  }
  return {
    label: relativeLabel(sig.ingested_at),
    sourceName: sig.source_name ?? "Signal",
    source: sig.source_type ?? "manual",
    daysAgo: daysSince(sig.ingested_at),
  };
}

export function toRadarCompany(
  c: DbCompany,
  lastSignal: DbSignal | LastSignalRow | null = null,
  watched = false,
  agg: ConvictionAgg | null = null
): RadarCompany {
  const days = daysSince(c.current_stage_since);
  const pulled = c.current_stage === "pulled";
  const isCol3 = c.current_stage === "on_hold" || pulled;
  const ls = lastSignalFrom(lastSignal);
  const conviction = computeConviction({
    lastSignalAgeDays: ls.daysAgo,
    confidence: c.confidence,
    stage: c.current_stage,
    signalCount30d: agg?.signalCount30d,
    distinctSourceTypes: agg?.distinctSourceTypes,
  });
  const marketTiming = computeMarketTiming({
    stage: c.current_stage,
    dealType: c.deal_type,
    daysInStage: days,
  });
  const quote =
    lastSignal == null
      ? undefined
      : "llm_output" in lastSignal
        ? (lastSignal.llm_output?.key_quote ?? undefined)
        : (lastSignal.key_quote ?? undefined);

  return {
    id: c.id,
    companyId: c.id,
    name: c.name,
    dealType: c.deal_type,
    sector: c.sector,
    confidence: c.confidence,
    stage: c.current_stage,
    pulled: pulled || undefined,
    ownerName: ownerName(c),
    days,
    stageNote: isCol3
      ? pulled
        ? `Pulled · ${relativeLabel(c.current_stage_since)}`
        : `On hold · ${stageDaysLabel(days)}`
      : undefined,
    added: c.created_at,
    addedDisplay: shortDate(c.created_at),
    lastSignal: ls,
    conviction,
    marketTiming,
    quote,
    watchlisted: watched || undefined,
    subsector: c.subsector,
    logoUrl: c.logo_url,
    revenue: c.revenue,
    ebitda: c.ebitda,
    margin: c.margin,
    description: c.description,
    revenueSource: c.revenue_source_url,
    ebitdaSource: c.ebitda_source_url,
    ourProcessStage: c.our_process_stage ?? null,
    processKeyDates: c.process_key_dates ?? null,
  };
}

export function toCompanyProfile(c: DbCompany): Company {
  return {
    id: c.id,
    name: c.name,
    sector: c.sector,
    subsector: c.subsector,
    dealType: c.deal_type,
    sponsorFirm: c.sponsor_firm,
    parentCompany: c.parent_company,
    description: c.description ?? "",
    confidence: c.confidence,
    currentStage: c.current_stage,
    daysInStage: daysSince(c.current_stage_since),
    firstTracked: c.created_at,
    lastUpdated: c.updated_at,
    logoUrl: c.logo_url,
    revenue: c.revenue,
    ebitda: c.ebitda,
    margin: c.margin,
    revenueSource: c.revenue_source_url,
    ebitdaSource: c.ebitda_source_url,
    outcome: c.outcome ?? null,
    acquirer: c.acquirer ?? null,
    closeMultiple: c.close_multiple ?? null,
    closedAt: c.closed_at ?? null,
  };
}

export function toStageHistory(rows: DbHistory[]): StageHistoryRecord[] {
  return rows.map((h) => ({
    id: h.id,
    companyId: h.company_id,
    stage: h.stage,
    changedAt: h.changed_at,
    changedBy: h.changed_by,
    sourceType: h.source_type ?? "manual",
    sourceUrl: h.source_url,
    notes: h.headline ?? h.notes,
  }));
}

export function toSignals(rows: DbSignal[]): Signal[] {
  return rows.map((s) => {
    const quote = s.llm_output?.key_quote ?? null;
    const raw = s.raw_text ?? null;
    return {
      id: s.id,
      companyId: s.company_id ?? "",
      sourceType: s.source_type ?? "manual",
      sourceUrl: s.source_url ?? "#",
      sourceName: s.source_name ?? undefined,
      title: `${s.source_name ?? "Signal"}${s.doc_type ? ` — ${s.doc_type}` : ""}`,
      excerpt: quote ?? raw ?? "",
      // Surface the underlying source text only when it adds context beyond the quote.
      rawExcerpt: quote && raw && raw !== quote ? raw : null,
      reasoning: s.llm_output?.reasoning ?? null,
      ingestedAt: s.ingested_at,
    };
  });
}

export function toNotes(rows: DbNote[]): Note[] {
  return rows.map((n) => ({
    id: n.id,
    companyId: n.company_id,
    userId: n.user_id,
    author: n.author ?? "Analyst",
    initials: initialsOf(n.author),
    content: n.content,
    createdAt: n.created_at,
  }));
}
