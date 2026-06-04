import { describe, it, expect } from "vitest";
import { dice } from "@/lib/ingest/similarity";

describe("dice coefficient (entity resolution)", () => {
  it("returns 1 for identical (normalized) names", () => {
    expect(dice("Dow Polyurethanes", "Dow Polyurethanes")).toBe(1);
    // legal suffixes are stripped in normalization
    expect(dice("Archroma Inc", "Archroma")).toBe(1);
  });

  it("scores close variants above the 0.85 match threshold", () => {
    expect(dice("Nouryon Surfactants", "Nouryon Surfactant")).toBeGreaterThan(0.85);
  });

  it("scores unrelated names low", () => {
    expect(dice("Apple", "Microsoft")).toBeLessThan(0.3);
  });

  it("handles empty input", () => {
    expect(dice("", "Anything")).toBe(0);
  });
});
