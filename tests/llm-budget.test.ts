import { describe, it, expect } from "vitest";
import {
  monthKey,
  monthStartIso,
  parseBudgetUsd,
  isWithinBudget,
} from "@/lib/llm-budget";

describe("monthKey / monthStartIso", () => {
  it("formats the UTC month", () => {
    expect(monthKey(new Date("2026-06-13T10:00:00Z"))).toBe("2026-06");
    expect(monthKey(new Date("2026-01-01T00:00:00Z"))).toBe("2026-01");
    expect(monthKey(new Date("2026-12-31T23:59:59Z"))).toBe("2026-12");
  });

  it("month start is the first instant of that UTC month", () => {
    expect(monthStartIso(new Date("2026-06-13T10:00:00Z"))).toBe(
      "2026-06-01T00:00:00.000Z"
    );
  });
});

describe("parseBudgetUsd", () => {
  it("returns null when unset or blank", () => {
    expect(parseBudgetUsd(undefined)).toBeNull();
    expect(parseBudgetUsd("")).toBeNull();
    expect(parseBudgetUsd("   ")).toBeNull();
  });

  it("returns null for non-numeric or non-positive", () => {
    expect(parseBudgetUsd("abc")).toBeNull();
    expect(parseBudgetUsd("0")).toBeNull();
    expect(parseBudgetUsd("-5")).toBeNull();
  });

  it("parses a positive cap", () => {
    expect(parseBudgetUsd("250")).toBe(250);
    expect(parseBudgetUsd("19.99")).toBe(19.99);
  });
});

describe("isWithinBudget", () => {
  it("is unbounded when no cap is set", () => {
    expect(isWithinBudget(1_000_000, null)).toBe(true);
  });

  it("is within while spend is below the cap", () => {
    expect(isWithinBudget(99, 100)).toBe(true);
  });

  it("is over once spend reaches or exceeds the cap", () => {
    expect(isWithinBudget(100, 100)).toBe(false);
    expect(isWithinBudget(150, 100)).toBe(false);
  });
});
