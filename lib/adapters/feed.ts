// DB stage-history (⋈ signal llm_output ⋈ company) → feed item shape.
// Output is a superset of lib/feed-data FeedItem: `day` is replaced with real
// `dateKey` + `dayLabel` (the wired feed page groups by these in Layer 12).

import type { DbHistory, DbFeedEvent, LlmOutput } from "@/types/db";
import type { FeedItemType, ExpandedContent } from "@/lib/feed-data";
import type { DealType, Sector, Confidence, Stage, SourceType } from "@/lib/types";
import { SECTOR_LABELS } from "@/lib/colors";
import { relativeLabel, dayBucketLabel, dateKey } from "./time";

export interface CompanyMin {
  id: string;
  name: string;
  dealType: DealType;
  sector: Sector;
  confidence: Confidence;
}

export interface FeedItemData {
  id: string;
  type: FeedItemType;
  companyId: string;
  company: string;
  dealType: DealType;
  sector: Sector;
  confidence: Confidence;
  stage: Stage;
  headline: string;
  source: { sourceType: SourceType; name: string; docType: string };
  sourceUrl: string;
  timeLabel: string;
  dateKey: string;
  dayLabel: string;
  expanded?: ExpandedContent;
}

const EVENT_MAP: Record<DbFeedEvent, FeedItemType> = {
  moved_in_market: "to_in_market",
  moved_monitor: "to_monitor",
  moved_on_hold: "to_on_hold",
  pulled: "pulled",
  new_entry: "new_entry",
  flagged: "flagged",
  confidence_update: "confidence_update",
  hsr_filed: "hsr_filed",
};

function buildExpanded(
  h: DbHistory,
  llm: LlmOutput | null | undefined,
  sector: Sector
): ExpandedContent | undefined {
  if (llm?.conflict) {
    return {
      kind: "conflict",
      signalA: llm.conflict.signalA,
      signalB: llm.conflict.signalB,
    };
  }
  if (llm?.new_entry) {
    return {
      kind: "new_entry",
      ownerLabel: llm.new_entry.owner_label,
      ownerName: llm.new_entry.owner_name,
      sectorLabel: SECTOR_LABELS[sector],
      dealSize: llm.new_entry.deal_size,
      reason: llm.new_entry.reason,
    };
  }
  if (llm?.key_quote) {
    return { kind: "quote", text: llm.key_quote, attribution: llm.attribution ?? "" };
  }
  if (h.event_type === "confidence_update" && h.notes) {
    return { kind: "note", text: h.notes };
  }
  return undefined;
}

export function toFeedItem(
  h: DbHistory,
  company: CompanyMin,
  llm: LlmOutput | null = null
): FeedItemData {
  const type = EVENT_MAP[h.event_type ?? "moved_in_market"];
  return {
    id: h.id,
    type,
    companyId: company.id,
    company: company.name,
    dealType: company.dealType,
    sector: company.sector,
    confidence: company.confidence,
    stage: h.stage,
    headline: h.headline ?? llm?.headline ?? "",
    source: {
      sourceType: h.source_type ?? "manual",
      name: h.source_name ?? "Source",
      docType: h.doc_type ?? "",
    },
    sourceUrl: h.source_url ?? "#",
    timeLabel: relativeLabel(h.changed_at),
    dateKey: dateKey(h.changed_at),
    dayLabel: dayBucketLabel(h.changed_at),
    expanded: buildExpanded(h, llm, company.sector),
  };
}
