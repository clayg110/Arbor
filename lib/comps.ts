// Comparable-deal scoring. Pure — no I/O, no framework imports.
// Reuses the bigram Dice coefficient from lib/ingest/similarity for name
// near-duplicate detection; uses structural attributes for the actual score.

import { dice } from "@/lib/ingest/similarity";
import type { Sector, DealType, Stage } from "@/lib/types";

export interface CompInput {
  id: string;
  name: string;
  sector: Sector | string;
  dealType: DealType | string;
  stage: Stage | string;
  revenue?: string | null;
  ebitda?: string | null;
  outcome?: string | null;
  closedAt?: string | null;
  closeMultiple?: string | null;
}

export interface CompResult extends CompInput {
  score: number;
  matchReasons: string[];
}

// Stage ordering used for adjacency scoring.
const STAGE_ORDER: Stage[] = ["monitor_for_exit", "in_market", "on_hold", "pulled"];

// Parse a financial magnitude string (e.g. "$500M–$700M", "~$2B", "$1.2B") to a
// rough size band. Returns null when no magnitude is found.
export function sizeBand(s: string | null | undefined): "small" | "mid" | "large" | null {
  if (!s) return null;
  const m = s.match(/\$?([\d.]+)\s*([BbMm])/);
  if (!m) return null;
  let v = parseFloat(m[1]);
  if (m[2].toLowerCase() === "b") v *= 1000; // billions → millions
  if (v >= 1000) return "large";
  if (v >= 200) return "mid";
  return "small";
}

// Score one candidate against a target. Returns null when the candidate is the
// same deal (by id or near-duplicate name) — callers should filter these out.
//
// Weights: sector 40 | dealType 30 | stage proximity 10-20 | size 10
export function scoreComp(
  target: CompInput,
  candidate: CompInput
): { score: number; matchReasons: string[] } | null {
  if (target.id === candidate.id) return null;
  if (dice(target.name, candidate.name) > 0.85) return null;

  let score = 0;
  const matchReasons: string[] = [];

  if (target.sector === candidate.sector) {
    score += 40;
    matchReasons.push("Same sector");
  }

  if (target.dealType === candidate.dealType) {
    score += 30;
    matchReasons.push("Same deal type");
  }

  const ti = STAGE_ORDER.indexOf(target.stage as Stage);
  const ci = STAGE_ORDER.indexOf(candidate.stage as Stage);
  if (ti !== -1 && ci !== -1) {
    const dist = Math.abs(ti - ci);
    if (dist === 0) {
      score += 20;
      matchReasons.push("Same stage");
    } else if (dist === 1) {
      score += 10;
      matchReasons.push("Adjacent stage");
    }
  }

  const tb = sizeBand(target.revenue) ?? sizeBand(target.ebitda);
  const cb = sizeBand(candidate.revenue) ?? sizeBand(candidate.ebitda);
  if (tb && cb && tb === cb) {
    score += 10;
    matchReasons.push("Similar size");
  }

  return { score, matchReasons };
}

export interface CompsFilter {
  sector: string; // "" = all
  sizeBand: "small" | "mid" | "large" | ""; // "" = all
  dealType: string; // "" = all
  outcome: string; // "" = all
  closedAfter: string; // ISO date or ""
  closedBefore: string; // ISO date or ""
}

export const EMPTY_FILTER: CompsFilter = {
  sector: "",
  sizeBand: "",
  dealType: "",
  outcome: "",
  closedAfter: "",
  closedBefore: "",
};

export function applyCompsFilter(comps: CompResult[], f: CompsFilter): CompResult[] {
  return comps.filter((c) => {
    if (f.sector && c.sector !== f.sector) return false;
    if (f.dealType && c.dealType !== f.dealType) return false;
    if (f.outcome && c.outcome !== f.outcome) return false;
    if (f.sizeBand) {
      const band = sizeBand(c.revenue) ?? sizeBand(c.ebitda);
      if (band !== f.sizeBand) return false;
    }
    if (f.closedAfter) {
      if (!c.closedAt || c.closedAt < f.closedAfter) return false;
    }
    if (f.closedBefore) {
      if (!c.closedAt || c.closedAt > f.closedBefore) return false;
    }
    return true;
  });
}

export function compsToCSV(comps: CompResult[]): string {
  const HEADERS = [
    "Name",
    "Sector",
    "Deal Type",
    "Stage",
    "Revenue",
    "EBITDA",
    "Exit Multiple",
    "Outcome",
    "Closed",
    "Score",
    "Match Reasons",
  ];

  function esc(v: string | null | undefined): string {
    if (!v) return "";
    const s = String(v);
    return s.includes(",") || s.includes('"') || s.includes("\n")
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  }

  const rows = comps.map((c) =>
    [
      esc(c.name),
      esc(c.sector),
      esc(c.dealType),
      esc(c.stage),
      esc(c.revenue),
      esc(c.ebitda),
      esc(c.closeMultiple),
      esc(c.outcome),
      esc(c.closedAt),
      String(c.score),
      esc(c.matchReasons.join("; ")),
    ].join(",")
  );

  return [HEADERS.join(","), ...rows].join("\n");
}

// Rank all candidates against a target and return the top N with score >= 30.
export function topComps(
  target: CompInput,
  candidates: CompInput[],
  limit = 5
): CompResult[] {
  const scored: CompResult[] = [];
  for (const c of candidates) {
    const r = scoreComp(target, c);
    if (!r || r.score < 30) continue;
    scored.push({ ...c, score: r.score, matchReasons: r.matchReasons });
  }
  return scored.sort((a, b) => b.score - a.score).slice(0, limit);
}
