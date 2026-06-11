// Natural-language query parser for radar search.
// Strips recognized keywords (sector, deal type, stage, confidence, conviction band)
// from the input and returns structured filter fields plus the unmatched remainder
// as a free-text query. Pure — no I/O, no imports other than local types.

import type { Sector, DealType, Stage, Confidence } from "@/lib/types";
import type { ConvictionBand } from "@/lib/conviction";

export interface NlQueryResult {
  text?: string;
  sector?: Sector;
  dealType?: DealType;
  stage?: Stage;
  confidence?: Confidence;
  convictionBand?: ConvictionBand;
}

// Ordered longest-first so "in market" is matched before "market", etc.
const SECTOR_PHRASES: { phrase: string; sector: Sector }[] = [
  { phrase: "aerospace defense", sector: "aerospace_defense" },
  { phrase: "aerospace_defense", sector: "aerospace_defense" },
  { phrase: "specialty materials", sector: "specialty_materials" },
  { phrase: "specialty_materials", sector: "specialty_materials" },
  { phrase: "energy fuels", sector: "energy_fuels" },
  { phrase: "energy_fuels", sector: "energy_fuels" },
  { phrase: "pharma inputs", sector: "pharma_inputs" },
  { phrase: "pharma_inputs", sector: "pharma_inputs" },
  { phrase: "consumer coatings", sector: "consumer_coatings" },
  { phrase: "consumer_coatings", sector: "consumer_coatings" },
  { phrase: "basic materials", sector: "basic_materials" },
  { phrase: "basic_materials", sector: "basic_materials" },
  { phrase: "capital goods", sector: "capital_goods" },
  { phrase: "capital_goods", sector: "capital_goods" },
  { phrase: "aerospace", sector: "aerospace_defense" },
  { phrase: "chemicals", sector: "chemicals" },
  { phrase: "industrials", sector: "industrials" },
  { phrase: "agriculture", sector: "agriculture" },
  { phrase: "automotive", sector: "automotive" },
  { phrase: "transportation", sector: "transportation" },
  { phrase: "pharma", sector: "pharma_inputs" },
  { phrase: "consumer", sector: "consumer_coatings" },
  { phrase: "energy", sector: "energy_fuels" },
];

const DEAL_PHRASES: { phrase: string; dealType: DealType }[] = [
  { phrase: "private assets", dealType: "private_asset" },
  { phrase: "private asset", dealType: "private_asset" },
  { phrase: "private_asset", dealType: "private_asset" },
  { phrase: "carve-out", dealType: "carveout" },
  { phrase: "carveouts", dealType: "carveout" },
  { phrase: "carveout", dealType: "carveout" },
  { phrase: "private", dealType: "private_asset" },
];

const STAGE_PHRASES: { phrase: string; stage: Stage }[] = [
  { phrase: "monitor for exit", stage: "monitor_for_exit" },
  { phrase: "monitor_for_exit", stage: "monitor_for_exit" },
  { phrase: "in market", stage: "in_market" },
  { phrase: "in_market", stage: "in_market" },
  { phrase: "on hold", stage: "on_hold" },
  { phrase: "on_hold", stage: "on_hold" },
  { phrase: "monitor", stage: "monitor_for_exit" },
  { phrase: "pulled", stage: "pulled" },
  { phrase: "hold", stage: "on_hold" },
];

const CONFIDENCE_PHRASES: { phrase: string; confidence: Confidence }[] = [
  { phrase: "needs review", confidence: "needs_review" },
  { phrase: "needs_review", confidence: "needs_review" },
  { phrase: "high confidence", confidence: "high" },
  { phrase: "medium confidence", confidence: "medium" },
  { phrase: "low confidence", confidence: "low" },
  { phrase: "high", confidence: "high" },
  { phrase: "medium", confidence: "medium" },
  { phrase: "low", confidence: "low" },
  { phrase: "review", confidence: "needs_review" },
];

const CONVICTION_PHRASES: { phrase: string; convictionBand: ConvictionBand }[] = [
  { phrase: "heating up", convictionBand: "hot" },
  { phrase: "hot", convictionBand: "hot" },
  { phrase: "warm", convictionBand: "warm" },
  { phrase: "cold", convictionBand: "cold" },
];

function stripFirst(s: string, phrase: string): string {
  // Replace only the first occurrence; phrase boundary = space/start/end.
  const re = new RegExp(`(^|\\s)${escapeRe(phrase)}(\\s|$)`, "i");
  return s
    .replace(re, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function matchAny<T>(
  s: string,
  phrases: { phrase: string; [k: string]: unknown }[],
  key: string
): { value: T; remainder: string } | null {
  for (const p of phrases) {
    const re = new RegExp(`(^|\\s)${escapeRe(p.phrase)}(\\s|$)`, "i");
    if (re.test(s)) {
      return { value: p[key] as T, remainder: stripFirst(s, p.phrase) };
    }
  }
  return null;
}

export function parseNlQuery(q: string): NlQueryResult {
  let rem = q.trim();
  const result: NlQueryResult = {};

  const sector = matchAny<Sector>(rem, SECTOR_PHRASES, "sector");
  if (sector) {
    result.sector = sector.value;
    rem = sector.remainder;
  }

  const deal = matchAny<DealType>(rem, DEAL_PHRASES, "dealType");
  if (deal) {
    result.dealType = deal.value;
    rem = deal.remainder;
  }

  const stage = matchAny<Stage>(rem, STAGE_PHRASES, "stage");
  if (stage) {
    result.stage = stage.value;
    rem = stage.remainder;
  }

  const confidence = matchAny<Confidence>(rem, CONFIDENCE_PHRASES, "confidence");
  if (confidence) {
    result.confidence = confidence.value;
    rem = confidence.remainder;
  }

  const conviction = matchAny<ConvictionBand>(rem, CONVICTION_PHRASES, "convictionBand");
  if (conviction) {
    result.convictionBand = conviction.value;
    rem = conviction.remainder;
  }

  const text = rem.trim();
  if (text) result.text = text;

  return result;
}
