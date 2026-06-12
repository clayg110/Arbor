import { describe, it, expect } from "vitest";
import { computeWinLoss } from "@/lib/win-loss";
import type { Company } from "@/lib/types";

function makeCompany(
  id: string,
  outcome: "closed" | "withdrawn" | null,
  sector: string,
  confidence: string
): Company {
  return {
    id,
    name: `Company ${id}`,
    sector: sector as Company["sector"],
    dealType: "carveout",
    confidence: confidence as Company["confidence"],
    currentStage: "in_market",
    daysInStage: 30,
    description: "",
    firstTracked: "2025-01-01",
    lastUpdated: "2025-06-01",
    outcome: outcome as Company["outcome"],
  };
}

describe("computeWinLoss", () => {
  it("returns zeros when no companies", () => {
    const result = computeWinLoss([]);
    expect(result.total).toBe(0);
    expect(result.wins).toBe(0);
    expect(result.losses).toBe(0);
    expect(result.winRate).toBe(0);
  });

  it("ignores companies with no outcome", () => {
    const companies = [makeCompany("1", null, "chemicals", "high")];
    const result = computeWinLoss(companies);
    expect(result.total).toBe(0);
  });

  it("counts wins (closed) and losses (withdrawn)", () => {
    const companies = [
      makeCompany("1", "closed", "chemicals", "high"),
      makeCompany("2", "closed", "chemicals", "high"),
      makeCompany("3", "withdrawn", "chemicals", "low"),
    ];
    const result = computeWinLoss(companies);
    expect(result.wins).toBe(2);
    expect(result.losses).toBe(1);
    expect(result.total).toBe(3);
    expect(result.winRate).toBe(67);
  });

  it("computes 100% win rate when all closed", () => {
    const companies = [
      makeCompany("1", "closed", "chemicals", "high"),
      makeCompany("2", "closed", "industrials", "medium"),
    ];
    const result = computeWinLoss(companies);
    expect(result.winRate).toBe(100);
  });

  it("computes 0% win rate when all withdrawn", () => {
    const companies = [
      makeCompany("1", "withdrawn", "chemicals", "low"),
      makeCompany("2", "withdrawn", "industrials", "low"),
    ];
    const result = computeWinLoss(companies);
    expect(result.winRate).toBe(0);
  });

  it("groups by sector correctly", () => {
    const companies = [
      makeCompany("1", "closed", "chemicals", "high"),
      makeCompany("2", "withdrawn", "chemicals", "low"),
      makeCompany("3", "closed", "industrials", "high"),
    ];
    const result = computeWinLoss(companies);
    const chemEntry = result.bySector.find((s) => s.sector === "chemicals");
    const indEntry = result.bySector.find((s) => s.sector === "industrials");
    expect(chemEntry?.wins).toBe(1);
    expect(chemEntry?.losses).toBe(1);
    expect(indEntry?.wins).toBe(1);
    expect(indEntry?.losses).toBe(0);
  });

  it("groups by confidence and sorts by CONF_ORDER", () => {
    const companies = [
      makeCompany("1", "closed", "chemicals", "high"),
      makeCompany("2", "withdrawn", "chemicals", "low"),
      makeCompany("3", "closed", "chemicals", "medium"),
    ];
    const result = computeWinLoss(companies);
    const highEntry = result.byConfidence.find((c) => c.confidence === "high");
    expect(highEntry?.wins).toBe(1);
    expect(highEntry?.losses).toBe(0);
    // high should appear before low
    const highIdx = result.byConfidence.findIndex((c) => c.confidence === "high");
    const lowIdx = result.byConfidence.findIndex((c) => c.confidence === "low");
    expect(highIdx).toBeLessThan(lowIdx);
  });

  it("sorts bySector by total descending", () => {
    const companies = [
      makeCompany("1", "closed", "industrials", "high"),
      makeCompany("2", "closed", "chemicals", "high"),
      makeCompany("3", "withdrawn", "chemicals", "low"),
      makeCompany("4", "closed", "chemicals", "medium"),
    ];
    const result = computeWinLoss(companies);
    // chemicals has 3 outcomes, industrials has 1
    expect(result.bySector[0]!.sector).toBe("chemicals");
  });
});
