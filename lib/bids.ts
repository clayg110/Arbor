// Pure helpers for the bid / offer tracker. No I/O.

export type BidType = "indicative" | "final";
export type BidRound = "1" | "2" | "final";

export const BID_TYPE_LABELS: Record<BidType, string> = {
  indicative: "Indicative",
  final: "Final",
};

export const BID_ROUND_LABELS: Record<BidRound, string> = {
  "1": "1st round",
  "2": "2nd round",
  final: "Final round",
};

export interface Bid {
  id: string;
  companyId: string;
  userId: string;
  orgId: string | null;
  bidType: BidType;
  round: BidRound;
  bidDate: string;
  amountUsd: number | null;
  multipleOnEbitda: number | null;
  rationale: string | null;
  createdAt: string;
}

export interface BidInput {
  bidType: BidType;
  round: BidRound;
  bidDate: string;
  amountUsd: number | null;
  multipleOnEbitda: number | null;
  rationale: string | null;
}

// Short one-line summary for display in bid history.
export function bidSummary(bid: Bid): string {
  const parts: string[] = [BID_TYPE_LABELS[bid.bidType], BID_ROUND_LABELS[bid.round]];
  if (bid.multipleOnEbitda !== null) {
    parts.push(`${bid.multipleOnEbitda.toFixed(1)}x EBITDA`);
  }
  if (bid.amountUsd !== null) {
    parts.push(`$${bid.amountUsd.toFixed(0)}M`);
  }
  return parts.join(" · ");
}

// Average EBITDA multiple across bids that have one recorded.
export function avgMultiple(bids: Bid[]): number | null {
  const multiples = bids
    .map((b) => b.multipleOnEbitda)
    .filter((m): m is number => m !== null);
  if (multiples.length === 0) return null;
  return multiples.reduce((sum, m) => sum + m, 0) / multiples.length;
}

export interface SectorBidSummary {
  sector: string;
  bidCount: number;
  avgMultiple: number | null;
}

// Aggregate bids by sector. `bidsWithSector` is a flat list of bids already
// joined to their company's sector (done at call site to keep this pure).
export function sectorBidSummary(
  bidsWithSector: (Bid & { sector: string })[]
): SectorBidSummary[] {
  const map = new Map<string, { bids: Bid[] }>();
  for (const b of bidsWithSector) {
    const entry = map.get(b.sector) ?? { bids: [] };
    entry.bids.push(b);
    map.set(b.sector, entry);
  }
  return [...map.entries()].map(([sector, { bids }]) => ({
    sector,
    bidCount: bids.length,
    avgMultiple: avgMultiple(bids),
  }));
}
