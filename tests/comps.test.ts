import { describe, it, expect } from "vitest";
import { scoreComp, topComps, sizeBand, type CompInput } from "@/lib/comps";

// ---- sizeBand ----
describe("sizeBand", () => {
  it("parses billions", () => {
    expect(sizeBand("$2B")).toBe("large");
    expect(sizeBand("$1.5B")).toBe("large");
    expect(sizeBand("~$3B")).toBe("large");
  });

  it("parses millions into bands", () => {
    expect(sizeBand("$150M")).toBe("small");
    expect(sizeBand("$500M")).toBe("mid");
    expect(sizeBand("$900M")).toBe("mid");
  });

  it("uses first magnitude in range strings", () => {
    expect(sizeBand("$800M–$1.2B")).toBe("mid"); // $800M → 800 → mid
    expect(sizeBand("$1.5B–$2B")).toBe("large");
  });

  it("returns null for unrecognised strings", () => {
    expect(sizeBand(null)).toBeNull();
    expect(sizeBand(undefined)).toBeNull();
    expect(sizeBand("unknown")).toBeNull();
  });
});

// ---- fixtures ----
const base: CompInput = {
  id: "t1",
  name: "Dow Polyurethanes",
  sector: "chemicals",
  dealType: "carveout",
  stage: "in_market",
};

const sectorMatch: CompInput = {
  id: "c1",
  name: "Celanese Infraserv",
  sector: "chemicals",
  dealType: "carveout",
  stage: "in_market",
};

const crossSector: CompInput = {
  id: "c2",
  name: "GEON Performance Solutions",
  sector: "specialty_materials",
  dealType: "private_asset",
  stage: "monitor_for_exit",
};

// ---- scoreComp ----
describe("scoreComp", () => {
  it("same sector + deal type + stage scores 90 (40+30+20)", () => {
    const r = scoreComp(base, sectorMatch);
    expect(r).not.toBeNull();
    expect(r!.score).toBe(90);
    expect(r!.matchReasons).toContain("Same sector");
    expect(r!.matchReasons).toContain("Same deal type");
    expect(r!.matchReasons).toContain("Same stage");
  });

  it("adjacent stage adds 10 instead of 20 (80 total)", () => {
    const adj: CompInput = { ...sectorMatch, id: "c3", stage: "monitor_for_exit" };
    const r = scoreComp(base, adj)!;
    expect(r.score).toBe(80);
    expect(r.matchReasons).toContain("Adjacent stage");
  });

  it("matching size band adds 10 pts", () => {
    // $500M → mid, $800M → mid → match
    const sized: CompInput = { ...sectorMatch, id: "c4", revenue: "$500M–$700M" };
    const target: CompInput = { ...base, revenue: "$800M–$1.2B" };
    expect(scoreComp(target, sized)!.score).toBe(100);
  });

  it("different size band: no bonus", () => {
    const large: CompInput = { ...sectorMatch, id: "c5", revenue: "$3B" };
    const small: CompInput = { ...base, revenue: "$150M" };
    expect(scoreComp(small, large)!.score).toBe(90);
  });

  it("cross-sector cross-type scores below 30", () => {
    const r = scoreComp(base, crossSector);
    // only possible is adjacent-stage (10); below threshold
    expect(r!.score).toBeLessThan(30);
  });

  it("returns null for same id", () => {
    expect(scoreComp(base, { ...base })).toBeNull();
  });

  it("returns null for near-duplicate name (dice > 0.85)", () => {
    const dupe: CompInput = { ...base, id: "other" };
    expect(scoreComp(base, dupe)).toBeNull();
  });
});

// ---- topComps ----
describe("topComps", () => {
  it("orders results by score descending", () => {
    const adj: CompInput = { ...sectorMatch, id: "c3", stage: "monitor_for_exit" };
    const results = topComps(base, [adj, sectorMatch], 5);
    expect(results[0]!.id).toBe(sectorMatch.id); // 90 > 80
    expect(results[1]!.id).toBe(adj.id);
  });

  it("excludes candidates scoring below 30", () => {
    expect(topComps(base, [crossSector], 5)).toHaveLength(0);
  });

  it("excludes self", () => {
    const results = topComps(base, [base, sectorMatch], 5);
    expect(results.find((r) => r.id === base.id)).toBeUndefined();
    expect(results[0]!.id).toBe(sectorMatch.id);
  });

  it("respects limit", () => {
    const many = Array.from({ length: 10 }, (_, i) => ({
      ...sectorMatch,
      id: `x${i}`,
      name: `Comp Company ${i}`,
    }));
    expect(topComps(base, many, 3)).toHaveLength(3);
  });

  it("returns empty array when no candidates match", () => {
    expect(topComps(base, [], 5)).toHaveLength(0);
  });
});
