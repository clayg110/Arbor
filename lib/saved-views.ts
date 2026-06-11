// Saved radar filter sets — pure helpers (validation, serialization).
// No I/O here; routes handle DB access.

import type { Sector, DealType, Stage, Confidence } from "@/lib/types";

export interface SavedViewFilters {
  sector?: Sector | "all";
  deal?: DealType | "all";
  sponsor?: string;
  confidence?: Confidence[];
  stages?: Stage[];
  search?: string;
  newThisWeek?: boolean;
  heating?: boolean;
}

export interface SavedView {
  id: string;
  name: string;
  filters: SavedViewFilters;
  createdAt: string;
}

const VALID_SECTORS: ReadonlySet<string> = new Set([
  "all",
  "chemicals",
  "industrials",
  "agriculture",
  "specialty_materials",
  "energy_fuels",
  "pharma_inputs",
  "consumer_coatings",
  "aerospace_defense",
  "capital_goods",
  "automotive",
  "transportation",
  "basic_materials",
]);

const VALID_DEAL_TYPES: ReadonlySet<string> = new Set([
  "all",
  "carveout",
  "private_asset",
]);
const VALID_STAGES: ReadonlySet<string> = new Set([
  "in_market",
  "monitor_for_exit",
  "on_hold",
  "pulled",
]);
const VALID_CONFIDENCE: ReadonlySet<string> = new Set([
  "high",
  "medium",
  "low",
  "needs_review",
]);

// Validates and sanitizes a raw filters object from user input or DB JSON.
// Returns a clean SavedViewFilters or throws with a descriptive message.
export function validateFilters(raw: unknown): SavedViewFilters {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    throw new Error("filters must be an object");
  }
  const f = raw as Record<string, unknown>;
  const out: SavedViewFilters = {};

  if (f.sector !== undefined) {
    if (typeof f.sector !== "string" || !VALID_SECTORS.has(f.sector)) {
      throw new Error(`invalid sector: ${f.sector}`);
    }
    out.sector = f.sector as Sector | "all";
  }

  if (f.deal !== undefined) {
    if (typeof f.deal !== "string" || !VALID_DEAL_TYPES.has(f.deal)) {
      throw new Error(`invalid deal: ${f.deal}`);
    }
    out.deal = f.deal as DealType | "all";
  }

  if (f.sponsor !== undefined) {
    if (typeof f.sponsor !== "string" || f.sponsor.length > 200) {
      throw new Error("invalid sponsor");
    }
    out.sponsor = f.sponsor;
  }

  if (f.confidence !== undefined) {
    if (
      !Array.isArray(f.confidence) ||
      !f.confidence.every((v) => VALID_CONFIDENCE.has(v))
    ) {
      throw new Error("invalid confidence array");
    }
    out.confidence = f.confidence as Confidence[];
  }

  if (f.stages !== undefined) {
    if (!Array.isArray(f.stages) || !f.stages.every((v) => VALID_STAGES.has(v))) {
      throw new Error("invalid stages array");
    }
    out.stages = f.stages as Stage[];
  }

  if (f.search !== undefined) {
    if (typeof f.search !== "string" || f.search.length > 200) {
      throw new Error("invalid search");
    }
    out.search = f.search;
  }

  if (f.newThisWeek !== undefined) {
    if (typeof f.newThisWeek !== "boolean")
      throw new Error("newThisWeek must be boolean");
    out.newThisWeek = f.newThisWeek;
  }

  if (f.heating !== undefined) {
    if (typeof f.heating !== "boolean") throw new Error("heating must be boolean");
    out.heating = f.heating;
  }

  return out;
}
