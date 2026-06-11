import { describe, it, expect } from "vitest";
import { validateFilters } from "@/lib/saved-views";

describe("validateFilters", () => {
  it("accepts empty object", () => {
    expect(validateFilters({})).toEqual({});
  });

  it("accepts valid full filter set", () => {
    const f = validateFilters({
      sector: "chemicals",
      deal: "carveout",
      confidence: ["high", "medium"],
      stages: ["in_market"],
      sponsor: "Dow Inc.",
      search: "poly",
      newThisWeek: true,
      heating: false,
    });
    expect(f.sector).toBe("chemicals");
    expect(f.deal).toBe("carveout");
    expect(f.confidence).toEqual(["high", "medium"]);
    expect(f.stages).toEqual(["in_market"]);
    expect(f.newThisWeek).toBe(true);
  });

  it("accepts sector = 'all'", () => {
    expect(validateFilters({ sector: "all" })).toMatchObject({ sector: "all" });
  });

  it("throws on invalid sector", () => {
    expect(() => validateFilters({ sector: "crypto" })).toThrow("invalid sector");
  });

  it("throws on invalid deal type", () => {
    expect(() => validateFilters({ deal: "ipo" })).toThrow("invalid deal");
  });

  it("throws on invalid stage in array", () => {
    expect(() => validateFilters({ stages: ["in_market", "unknown_stage"] })).toThrow(
      "invalid stages array"
    );
  });

  it("throws on invalid confidence value", () => {
    expect(() => validateFilters({ confidence: ["super_high"] })).toThrow(
      "invalid confidence array"
    );
  });

  it("throws on non-boolean newThisWeek", () => {
    expect(() => validateFilters({ newThisWeek: "yes" })).toThrow(
      "newThisWeek must be boolean"
    );
  });

  it("throws on non-object input", () => {
    expect(() => validateFilters("string")).toThrow("filters must be an object");
    expect(() => validateFilters(null)).toThrow("filters must be an object");
    expect(() => validateFilters([1, 2])).toThrow("filters must be an object");
  });

  it("ignores unknown keys (no error)", () => {
    // Unknown keys are silently dropped — only known keys are copied out.
    const f = validateFilters({ sector: "chemicals", unknownKey: "value" });
    expect(f.sector).toBe("chemicals");
    expect((f as Record<string, unknown>).unknownKey).toBeUndefined();
  });

  it("sponsor max length enforced", () => {
    expect(() => validateFilters({ sponsor: "x".repeat(201) })).toThrow(
      "invalid sponsor"
    );
  });
});
