// Pure win/loss analytics. Summarises closed/withdrawn deals to report win
// rate and breakdowns by sector and confidence band. Works entirely from the
// companies list already returned by /api/companies — no extra DB call needed.

import type { Company } from "@/lib/types";

export interface WinLossResult {
  total: number; // closed + withdrawn
  wins: number; // outcome = 'closed'
  losses: number; // outcome = 'withdrawn'
  // 0–100, rounded
  winRate: number;
  bySector: { sector: string; wins: number; losses: number; total: number }[];
  byConfidence: { confidence: string; wins: number; losses: number; total: number }[];
}

export function computeWinLoss(companies: Company[]): WinLossResult {
  const resolved = companies.filter(
    (c) => c.outcome === "closed" || c.outcome === "withdrawn"
  );
  const total = resolved.length;
  const wins = resolved.filter((c) => c.outcome === "closed").length;
  const losses = total - wins;
  const winRate = total === 0 ? 0 : Math.round((wins / total) * 100);

  const sectorMap = new Map<string, { wins: number; losses: number }>();
  const confMap = new Map<string, { wins: number; losses: number }>();

  for (const c of resolved) {
    const isWin = c.outcome === "closed";
    const s = sectorMap.get(c.sector) ?? { wins: 0, losses: 0 };
    if (isWin) s.wins++;
    else s.losses++;
    sectorMap.set(c.sector, s);

    const cf = confMap.get(c.confidence) ?? { wins: 0, losses: 0 };
    if (isWin) cf.wins++;
    else cf.losses++;
    confMap.set(c.confidence, cf);
  }

  const bySector = [...sectorMap.entries()]
    .map(([sector, v]) => ({ sector, ...v, total: v.wins + v.losses }))
    .sort((a, b) => b.total - a.total);

  const CONF_ORDER: Record<string, number> = {
    high: 0,
    medium: 1,
    low: 2,
    needs_review: 3,
  };
  const byConfidence = [...confMap.entries()]
    .map(([confidence, v]) => ({ confidence, ...v, total: v.wins + v.losses }))
    .sort((a, b) => (CONF_ORDER[a.confidence] ?? 9) - (CONF_ORDER[b.confidence] ?? 9));

  return { total, wins, losses, winRate, bySector, byConfidence };
}
