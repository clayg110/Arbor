import { describe, it, expect } from "vitest";
import {
  pipelineFunnel,
  ownerWorkload,
  sectorConcentration,
  upcomingKeyDates,
  staleDeals,
  type PipelineDeal,
} from "@/lib/pipeline";

function makeDeal(overrides: Partial<PipelineDeal> = {}): PipelineDeal {
  return {
    companyId: "c-1",
    companyName: "Acme Corp",
    sector: "chemicals",
    dealType: "carveout",
    ourProcessStage: "nda_signed",
    keyDates: {},
    daysInStage: 5,
    ownerId: null,
    ownerEmail: null,
    bidCount: 0,
    avgBidMultiple: null,
    ...overrides,
  };
}

describe("pipelineFunnel", () => {
  it("empty input returns empty result", () => {
    expect(pipelineFunnel([])).toEqual([]);
  });

  it("counts by stage, excludes terminal stages", () => {
    const deals = [
      makeDeal({ ourProcessStage: "nda_signed" }),
      makeDeal({ ourProcessStage: "nda_signed" }),
      makeDeal({ ourProcessStage: "cim_received" }),
      makeDeal({ ourProcessStage: "won" }),
      makeDeal({ ourProcessStage: "passed" }),
    ];
    const funnel = pipelineFunnel(deals);
    const stages = funnel.map((f) => f.stage);
    expect(stages).toContain("nda_signed");
    expect(stages).toContain("cim_received");
    expect(stages).not.toContain("won");
    expect(stages).not.toContain("passed");
    expect(funnel.find((f) => f.stage === "nda_signed")!.count).toBe(2);
    expect(funnel.find((f) => f.stage === "cim_received")!.count).toBe(1);
  });

  it("stages appear in process order", () => {
    const deals = [
      makeDeal({ ourProcessStage: "exclusivity" }),
      makeDeal({ ourProcessStage: "nda_signed" }),
      makeDeal({ ourProcessStage: "first_round_bid" }),
    ];
    const funnel = pipelineFunnel(deals);
    const stages = funnel.map((f) => f.stage);
    expect(stages.indexOf("nda_signed")).toBeLessThan(stages.indexOf("first_round_bid"));
    expect(stages.indexOf("first_round_bid")).toBeLessThan(stages.indexOf("exclusivity"));
  });
});

describe("ownerWorkload", () => {
  it("empty returns empty", () => {
    expect(ownerWorkload([])).toEqual([]);
  });

  it("groups by ownerId, sorted desc by count", () => {
    const deals = [
      makeDeal({ ownerId: "u1", ownerEmail: "alice@co.com" }),
      makeDeal({ ownerId: "u1", ownerEmail: "alice@co.com" }),
      makeDeal({ ownerId: "u2", ownerEmail: "bob@co.com" }),
    ];
    const result = ownerWorkload(deals);
    expect(result[0].ownerId).toBe("u1");
    expect(result[0].count).toBe(2);
    expect(result[1].count).toBe(1);
  });

  it("null ownerId grouped together", () => {
    const deals = [makeDeal({ ownerId: null }), makeDeal({ ownerId: null })];
    const result = ownerWorkload(deals);
    expect(result.length).toBe(1);
    expect(result[0].ownerId).toBeNull();
    expect(result[0].count).toBe(2);
  });
});

describe("sectorConcentration", () => {
  it("groups by sector sorted desc", () => {
    const deals = [
      makeDeal({ sector: "chemicals" }),
      makeDeal({ sector: "chemicals" }),
      makeDeal({ sector: "industrials" }),
    ];
    const result = sectorConcentration(deals);
    expect(result[0].sector).toBe("chemicals");
    expect(result[0].count).toBe(2);
    expect(result[1].sector).toBe("industrials");
    expect(result[1].count).toBe(1);
  });
});

describe("upcomingKeyDates", () => {
  it("returns dates within window, sorted ascending", () => {
    const deals = [
      makeDeal({
        companyId: "c1",
        companyName: "Alpha",
        ourProcessStage: "nda_signed",
        keyDates: { nda_signed: "2026-06-15" },
      }),
      makeDeal({
        companyId: "c2",
        companyName: "Beta",
        ourProcessStage: "exclusivity",
        keyDates: { exclusivity: "2026-07-01" },
      }),
    ];
    const result = upcomingKeyDates(deals, "2026-06-11", 30);
    expect(result.length).toBe(2);
    expect(result[0].companyName).toBe("Alpha");
    expect(result[1].companyName).toBe("Beta");
  });

  it("excludes dates before today", () => {
    const deals = [makeDeal({ keyDates: { nda_signed: "2026-06-01" } })];
    expect(upcomingKeyDates(deals, "2026-06-11", 30)).toEqual([]);
  });

  it("excludes dates beyond window", () => {
    const deals = [makeDeal({ keyDates: { nda_signed: "2026-08-01" } })];
    expect(upcomingKeyDates(deals, "2026-06-11", 30)).toEqual([]);
  });

  it("computes daysUntil correctly", () => {
    const deals = [makeDeal({ keyDates: { nda_signed: "2026-06-21" } })];
    const result = upcomingKeyDates(deals, "2026-06-11", 30);
    expect(result[0].daysUntil).toBe(10);
  });
});

describe("staleDeals", () => {
  it("returns deals where daysInStage > threshold, excludes terminal stages", () => {
    const deals = [
      makeDeal({ daysInStage: 10 }),
      makeDeal({ daysInStage: 35 }),
      makeDeal({ daysInStage: 50, ourProcessStage: "won" }),
    ];
    const result = staleDeals(deals, 30);
    expect(result.length).toBe(1);
    expect(result[0].daysInStage).toBe(35);
  });

  it("default threshold is 30, boundary is exclusive", () => {
    const deals = [makeDeal({ daysInStage: 31 }), makeDeal({ daysInStage: 30 })];
    const result = staleDeals(deals);
    expect(result.length).toBe(1);
    expect(result[0].daysInStage).toBe(31);
  });
});
