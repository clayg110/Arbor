import { describe, it, expect } from "vitest";
import {
  parseQuarter,
  currentQuarter,
  quarterRange,
  buildLpReport,
  lpReportToCsv,
  type LpDeal,
  type LpFund,
} from "@/lib/lp-report";
import { toFund } from "@/lib/adapters/funds";
import type { DbFund } from "@/types/db";

const FUNDS: LpFund[] = [
  { id: "f1", name: "Growth Fund III", vintageYear: 2024 },
  { id: "f2", name: "Buyout Fund I", vintageYear: 2019 },
  { id: "f3", name: "Empty Fund", vintageYear: 2025 },
];

function deal(p: Partial<LpDeal> & Pick<LpDeal, "companyId">): LpDeal {
  return {
    companyName: p.companyName ?? p.companyId,
    sector: p.sector ?? "Industrials",
    fundId: p.fundId ?? null,
    stage: p.stage ?? "in_market",
    conviction: p.conviction ?? null,
    bidCount: p.bidCount ?? 0,
    createdAt: p.createdAt ?? "2026-04-15T00:00:00Z",
    ...p,
  };
}

describe("parseQuarter", () => {
  it("parses a valid quarter", () => {
    expect(parseQuarter("2026-Q2")).toEqual({ year: 2026, quarter: 2 });
  });
  it("trims whitespace", () => {
    expect(parseQuarter("  2026-Q4 ")).toEqual({ year: 2026, quarter: 4 });
  });
  it("rejects malformed input", () => {
    expect(parseQuarter("2026-Q5")).toBeNull();
    expect(parseQuarter("2026-2")).toBeNull();
    expect(parseQuarter("garbage")).toBeNull();
  });
});

describe("currentQuarter", () => {
  it("maps months to quarters", () => {
    expect(currentQuarter(new Date("2026-01-10T00:00:00Z"))).toBe("2026-Q1");
    expect(currentQuarter(new Date("2026-04-10T00:00:00Z"))).toBe("2026-Q2");
    expect(currentQuarter(new Date("2026-12-31T00:00:00Z"))).toBe("2026-Q4");
  });
});

describe("quarterRange", () => {
  it("returns a half-open range for Q2", () => {
    expect(quarterRange("2026-Q2")).toEqual({
      start: "2026-04-01T00:00:00.000Z",
      end: "2026-07-01T00:00:00.000Z",
    });
  });
  it("returns null for bad input", () => {
    expect(quarterRange("nope")).toBeNull();
  });
});

describe("buildLpReport", () => {
  const deals: LpDeal[] = [
    deal({
      companyId: "a",
      fundId: "f1",
      stage: "in_market",
      conviction: 80,
      bidCount: 2,
    }),
    deal({
      companyId: "b",
      fundId: "f1",
      sector: "Healthcare",
      stage: "monitor_for_exit",
      conviction: 60,
      createdAt: "2026-01-01T00:00:00Z", // previous quarter
    }),
    deal({ companyId: "c", fundId: "f2", stage: "in_market", conviction: null }),
    deal({ companyId: "d", fundId: null, stage: "on_hold" }), // unassigned
  ];

  it("groups deals by fund, newest vintage first, unassigned last", () => {
    const r = buildLpReport(deals, FUNDS, "2026-Q2");
    expect(r.funds.map((s) => s.fund?.name ?? "Unassigned")).toEqual([
      "Growth Fund III", // 2024
      "Buyout Fund I", // 2019
      "Unassigned",
    ]);
  });

  it("skips funds with no deals", () => {
    const r = buildLpReport(deals, FUNDS, "2026-Q2");
    expect(r.funds.some((s) => s.fund?.id === "f3")).toBe(false);
  });

  it("counts deals, stages, and new-this-quarter within the range", () => {
    const r = buildLpReport(deals, FUNDS, "2026-Q2");
    const f1 = r.funds.find((s) => s.fund?.id === "f1")!;
    expect(f1.dealCount).toBe(2);
    expect(f1.newThisQuarter).toBe(1); // company b created in Q1
    expect(f1.byStage).toEqual([
      { stage: "in_market", label: "In market", count: 1 },
      { stage: "monitor_for_exit", label: "Monitor for exit", count: 1 },
    ]);
  });

  it("averages conviction over deals that have it", () => {
    const r = buildLpReport(deals, FUNDS, "2026-Q2");
    expect(r.funds.find((s) => s.fund?.id === "f1")!.avgConviction).toBe(70);
    expect(r.funds.find((s) => s.fund?.id === "f2")!.avgConviction).toBeNull();
  });

  it("sorts sectors by count desc", () => {
    const r = buildLpReport(deals, FUNDS, "2026-Q2");
    const f1 = r.funds.find((s) => s.fund?.id === "f1")!;
    expect(f1.bySector.map((s) => s.sector)).toEqual(["Healthcare", "Industrials"]);
  });

  it("sums bids and reports totals", () => {
    const r = buildLpReport(deals, FUNDS, "2026-Q2");
    expect(r.totalDeals).toBe(4);
    expect(r.funds.find((s) => s.fund?.id === "f1")!.totalBids).toBe(2);
  });

  it("throws on an invalid quarter", () => {
    expect(() => buildLpReport(deals, FUNDS, "bad")).toThrow(/Invalid quarter/);
  });
});

describe("toFund", () => {
  it("maps a db row to the frontend fund shape", () => {
    const row: DbFund = {
      id: "f1",
      org_id: "o1",
      created_by: "u1",
      name: "Growth Fund III",
      vintage_year: 2024,
      created_at: "2026-01-01",
    };
    expect(toFund(row)).toEqual({
      id: "f1",
      name: "Growth Fund III",
      vintageYear: 2024,
    });
  });
});

describe("lpReportToCsv", () => {
  it("emits one row per fund × stage with a header", () => {
    const deals = [
      deal({ companyId: "a", fundId: "f1", stage: "in_market", bidCount: 1 }),
      deal({ companyId: "b", fundId: "f1", stage: "on_hold" }),
    ];
    const csv = lpReportToCsv(buildLpReport(deals, FUNDS, "2026-Q2"));
    const lines = csv.split("\r\n");
    expect(lines[0]).toBe(
      "Fund,Vintage,Top sector,Stage,Deals in stage,New this quarter,Avg conviction,Total bids"
    );
    expect(lines).toHaveLength(3); // header + 2 stage rows
    expect(lines[1]).toContain("Growth Fund III");
    expect(lines[1]).toContain("2024");
  });
});
