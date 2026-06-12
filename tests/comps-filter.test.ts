import { describe, it, expect } from "vitest";
import { applyCompsFilter, compsToCSV, EMPTY_FILTER, type CompResult } from "@/lib/comps";

function comp(
  overrides: Partial<CompResult> & Pick<CompResult, "id" | "name">
): CompResult {
  return {
    sector: "industrials",
    dealType: "carveout",
    stage: "in_market",
    revenue: "$300M",
    ebitda: null,
    outcome: null,
    closedAt: null,
    closeMultiple: null,
    score: 70,
    matchReasons: ["Same sector"],
    ...overrides,
  };
}

const BASE: CompResult[] = [
  comp({ id: "1", name: "Acme", sector: "industrials", dealType: "carveout" }),
  comp({
    id: "2",
    name: "BetaCo",
    sector: "chemicals",
    dealType: "private_asset",
    revenue: "$1.5B",
    outcome: "closed",
    closedAt: "2025-03-01",
    closeMultiple: "11.5x",
  }),
  comp({
    id: "3",
    name: "GammaCo",
    sector: "industrials",
    dealType: "carveout",
    revenue: "$80M",
    outcome: "withdrawn",
    closedAt: "2024-06-15",
  }),
];

describe("applyCompsFilter", () => {
  it("no filter returns all comps", () => {
    expect(applyCompsFilter(BASE, EMPTY_FILTER)).toHaveLength(3);
  });

  it("filters by sector", () => {
    const result = applyCompsFilter(BASE, { ...EMPTY_FILTER, sector: "chemicals" });
    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe("2");
  });

  it("filters by dealType", () => {
    const result = applyCompsFilter(BASE, {
      ...EMPTY_FILTER,
      dealType: "private_asset",
    });
    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe("2");
  });

  it("filters by outcome closed", () => {
    const result = applyCompsFilter(BASE, { ...EMPTY_FILTER, outcome: "closed" });
    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe("2");
  });

  it("filters by outcome withdrawn", () => {
    const result = applyCompsFilter(BASE, {
      ...EMPTY_FILTER,
      outcome: "withdrawn",
    });
    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe("3");
  });

  it("filters by sizeBand large", () => {
    const result = applyCompsFilter(BASE, { ...EMPTY_FILTER, sizeBand: "large" });
    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe("2");
  });

  it("filters by sizeBand small", () => {
    const result = applyCompsFilter(BASE, { ...EMPTY_FILTER, sizeBand: "small" });
    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe("3");
  });

  it("filters by sizeBand mid", () => {
    const result = applyCompsFilter(BASE, { ...EMPTY_FILTER, sizeBand: "mid" });
    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe("1");
  });

  it("filters by closedAfter", () => {
    const result = applyCompsFilter(BASE, {
      ...EMPTY_FILTER,
      closedAfter: "2025-01-01",
    });
    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe("2");
  });

  it("filters by closedBefore", () => {
    const result = applyCompsFilter(BASE, {
      ...EMPTY_FILTER,
      closedBefore: "2025-01-01",
    });
    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe("3");
  });

  it("closedAfter excludes comps without closedAt", () => {
    const result = applyCompsFilter(BASE, {
      ...EMPTY_FILTER,
      closedAfter: "2025-01-01",
    });
    expect(result.map((r) => r.id)).not.toContain("1");
  });

  it("combines multiple filters (AND logic)", () => {
    const result = applyCompsFilter(BASE, {
      ...EMPTY_FILTER,
      sector: "industrials",
      outcome: "withdrawn",
    });
    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe("3");
  });

  it("returns empty when no comps match", () => {
    const result = applyCompsFilter(BASE, {
      ...EMPTY_FILTER,
      sector: "aerospace_defense",
    });
    expect(result).toHaveLength(0);
  });
});

describe("compsToCSV", () => {
  it("produces header row + data rows", () => {
    const csv = compsToCSV(BASE);
    const lines = csv.split("\n");
    expect(lines[0]).toContain("Name");
    expect(lines[0]).toContain("Score");
    expect(lines[0]).toContain("Match Reasons");
    expect(lines).toHaveLength(4); // header + 3 data rows
  });

  it("escapes commas in values", () => {
    const c = comp({ id: "x", name: "A, Corp", matchReasons: ["Same sector"] });
    const csv = compsToCSV([c]);
    expect(csv).toContain('"A, Corp"');
  });

  it("escapes double quotes in values", () => {
    const c = comp({
      id: "x",
      name: 'A "Inc"',
      matchReasons: ["Same sector"],
    });
    const csv = compsToCSV([c]);
    expect(csv).toContain('"A ""Inc"""');
  });

  it("returns only header for empty comps", () => {
    const csv = compsToCSV([]);
    expect(csv.split("\n")).toHaveLength(1);
  });

  it("includes closeMultiple and closedAt", () => {
    const csv = compsToCSV([BASE[1]!]);
    expect(csv).toContain("11.5x");
    expect(csv).toContain("2025-03-01");
  });
});
