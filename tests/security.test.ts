import { describe, it, expect } from "vitest";
import { safeEqual } from "@/lib/security";
import { keyHasScope } from "@/lib/api-keys";

describe("safeEqual", () => {
  it("is true for identical strings", () => {
    expect(safeEqual("Bearer abc123", "Bearer abc123")).toBe(true);
    expect(safeEqual("", "")).toBe(true);
  });
  it("is false for same-length differences", () => {
    expect(safeEqual("aaaa", "aaab")).toBe(false);
  });
  it("is false for length differences (no throw)", () => {
    expect(safeEqual("short", "a-much-longer-secret")).toBe(false);
  });
});

describe("keyHasScope", () => {
  it("treats a scopeless (legacy) key as full access", () => {
    expect(keyHasScope([], "read")).toBe(true);
  });
  it("honors an explicit scope and the wildcard", () => {
    expect(keyHasScope(["read"], "read")).toBe(true);
    expect(keyHasScope(["*"], "read")).toBe(true);
  });
  it("rejects a key lacking the needed scope", () => {
    expect(keyHasScope(["write"], "read")).toBe(false);
  });
});
