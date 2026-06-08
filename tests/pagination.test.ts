import { describe, it, expect } from "vitest";
import { encodeCursor, decodeCursor, clampLimit, keysetFilter } from "@/lib/pagination";

describe("encode/decodeCursor", () => {
  it("round-trips a cursor", () => {
    const c = { ts: "2026-01-01T00:00:00+00:00", id: "uuid-1" };
    expect(decodeCursor(encodeCursor(c))).toEqual(c);
  });

  it("returns null for empty / missing input", () => {
    expect(decodeCursor(null)).toBeNull();
    expect(decodeCursor(undefined)).toBeNull();
    expect(decodeCursor("")).toBeNull();
  });

  it("returns null when the payload has no separator", () => {
    const noSep = Buffer.from("justsometext").toString("base64url");
    expect(decodeCursor(noSep)).toBeNull();
  });

  it("preserves an id that itself contains a pipe", () => {
    const c = { ts: "2026-01-01T00:00:00Z", id: "a|b|c" };
    expect(decodeCursor(encodeCursor(c))).toEqual(c);
  });
});

describe("clampLimit", () => {
  it("defaults on null / non-numeric", () => {
    expect(clampLimit(null)).toBe(100);
    expect(clampLimit("abc")).toBe(100);
    expect(clampLimit(undefined, 25)).toBe(25);
  });
  it("bounds to [1, max] and truncates floats", () => {
    expect(clampLimit("0")).toBe(1);
    expect(clampLimit("99999")).toBe(500);
    expect(clampLimit("50")).toBe(50);
    expect(clampLimit("3.9")).toBe(3);
  });
});

describe("keysetFilter", () => {
  it("builds the DESC after-cursor predicate", () => {
    expect(keysetFilter("updated_at", "id", { ts: "T", id: "X" })).toBe(
      "updated_at.lt.T,and(updated_at.eq.T,id.lt.X)"
    );
  });
});
