import { describe, it, expect } from "vitest";
import { dedupeKey } from "@/lib/dedupe";

describe("dedupeKey", () => {
  it("is deterministic for the same url + text", () => {
    expect(dedupeKey("https://x/1", "hello")).toBe(dedupeKey("https://x/1", "hello"));
  });

  it("differs when url or text differs", () => {
    expect(dedupeKey("https://x/1", "a")).not.toBe(dedupeKey("https://x/2", "a"));
    expect(dedupeKey("https://x/1", "a")).not.toBe(dedupeKey("https://x/1", "b"));
  });

  it("returns a 64-char hex sha256", () => {
    expect(dedupeKey("u", "t")).toMatch(/^[0-9a-f]{64}$/);
  });

  it("ignores text past the 2000-char cap", () => {
    const base = "x".repeat(2000);
    expect(dedupeKey("u", base + "AAA")).toBe(dedupeKey("u", base + "ZZZ"));
  });
});
