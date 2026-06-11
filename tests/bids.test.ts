import { describe, it, expect } from "vitest";
import {
  bidSummary,
  avgMultiple,
  sectorBidSummary,
  BID_TYPE_LABELS,
  BID_ROUND_LABELS,
  type Bid,
} from "@/lib/bids";

function makeBid(overrides: Partial<Bid> = {}): Bid {
  return {
    id: "bid-1",
    companyId: "c-1",
    userId: "u-1",
    orgId: null,
    bidType: "indicative",
    round: "1",
    bidDate: "2026-05-15",
    amountUsd: null,
    multipleOnEbitda: null,
    rationale: null,
    createdAt: "2026-05-15T10:00:00Z",
    ...overrides,
  };
}

describe("BID_TYPE_LABELS / BID_ROUND_LABELS", () => {
  it("covers all types", () => {
    expect(BID_TYPE_LABELS["indicative"]).toBe("Indicative");
    expect(BID_TYPE_LABELS["final"]).toBe("Final");
  });

  it("covers all rounds", () => {
    expect(BID_ROUND_LABELS["1"]).toBe("1st round");
    expect(BID_ROUND_LABELS["2"]).toBe("2nd round");
    expect(BID_ROUND_LABELS["final"]).toBe("Final round");
  });
});

describe("bidSummary", () => {
  it("minimal bid (no amount, no multiple)", () => {
    const b = makeBid({ bidType: "indicative", round: "1" });
    expect(bidSummary(b)).toBe("Indicative · 1st round");
  });

  it("includes multiple when present", () => {
    const b = makeBid({ bidType: "final", round: "2", multipleOnEbitda: 11.2 });
    expect(bidSummary(b)).toBe("Final · 2nd round · 11.2x EBITDA");
  });

  it("includes amount when present", () => {
    const b = makeBid({ amountUsd: 420 });
    expect(bidSummary(b)).toBe("Indicative · 1st round · $420M");
  });

  it("includes both multiple and amount", () => {
    const b = makeBid({
      bidType: "final",
      round: "final",
      multipleOnEbitda: 12,
      amountUsd: 500.5,
    });
    expect(bidSummary(b)).toBe("Final · Final round · 12.0x EBITDA · $501M");
  });
});

describe("avgMultiple", () => {
  it("returns null for empty list", () => {
    expect(avgMultiple([])).toBeNull();
  });

  it("returns null when no bids have multiples", () => {
    expect(avgMultiple([makeBid(), makeBid()])).toBeNull();
  });

  it("averages present multiples, ignores nulls", () => {
    const bids = [
      makeBid({ multipleOnEbitda: 10 }),
      makeBid({ multipleOnEbitda: null }),
      makeBid({ multipleOnEbitda: 12 }),
    ];
    expect(avgMultiple(bids)).toBe(11);
  });

  it("single bid", () => {
    expect(avgMultiple([makeBid({ multipleOnEbitda: 9.5 })])).toBe(9.5);
  });
});

describe("sectorBidSummary", () => {
  it("empty input → empty result", () => {
    expect(sectorBidSummary([])).toEqual([]);
  });

  it("groups by sector and computes avg", () => {
    const bids = [
      { ...makeBid({ id: "1", multipleOnEbitda: 10 }), sector: "chemicals" },
      { ...makeBid({ id: "2", multipleOnEbitda: 12 }), sector: "chemicals" },
      { ...makeBid({ id: "3", multipleOnEbitda: 8 }), sector: "industrials" },
    ];
    const result = sectorBidSummary(bids);
    const chem = result.find((r) => r.sector === "chemicals");
    const ind = result.find((r) => r.sector === "industrials");
    expect(chem).toBeDefined();
    expect(chem!.bidCount).toBe(2);
    expect(chem!.avgMultiple).toBe(11);
    expect(ind!.bidCount).toBe(1);
    expect(ind!.avgMultiple).toBe(8);
  });

  it("null multiples give null avgMultiple for that sector", () => {
    const bids = [{ ...makeBid({ multipleOnEbitda: null }), sector: "tech" }];
    const result = sectorBidSummary(bids);
    expect(result[0].avgMultiple).toBeNull();
  });
});
