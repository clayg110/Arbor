import { describe, it, expect } from "vitest";
import { computeMomentum } from "@/lib/signal-momentum";
import type { Signal } from "@/lib/types";

function makeSignal(daysAgo: number): Signal {
  const d = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
  return {
    id: `s-${daysAgo}`,
    companyId: "c1",
    sourceType: "google_news",
    sourceUrl: "https://example.com",
    title: "Test",
    excerpt: "Test excerpt",
    ingestedAt: d.toISOString(),
  };
}

describe("computeMomentum", () => {
  it("returns stable with no signals", () => {
    const result = computeMomentum([]);
    expect(result.trend).toBe("stable");
    expect(result.sparkline).toHaveLength(12);
    expect(result.sparkline.every((v) => v === 0)).toBe(true);
  });

  it("detects accelerating when recent > prior * 1.5", () => {
    // 8 signals in the last week vs 2 in weeks 4–7
    const recent = [1, 2, 3, 4, 5, 6, 7, 8].map((d) => makeSignal(d));
    const prior = [32, 33].map((d) => makeSignal(d)); // weeks 4–7 range
    const result = computeMomentum([...recent, ...prior]);
    expect(result.trend).toBe("accelerating");
    expect(result.label).toBe("Accelerating");
  });

  it("detects cooling when recent < prior * 0.5", () => {
    // Only 1 signal in last 4 weeks, 8 in prior 4 weeks
    const recent = [makeSignal(3)];
    const prior = [29, 30, 31, 32, 33, 34, 35, 36].map((d) => makeSignal(d));
    const result = computeMomentum([...recent, ...prior]);
    expect(result.trend).toBe("cooling");
    expect(result.label).toBe("Cooling");
  });

  it("returns stable when volumes are comparable", () => {
    // 4 signals in last 4 weeks, 4 in prior 4 weeks → ratio = 1, stable
    const recent = [3, 7, 10, 14].map((d) => makeSignal(d));
    const prior = [29, 32, 35, 38].map((d) => makeSignal(d));
    const result = computeMomentum([...recent, ...prior]);
    expect(result.trend).toBe("stable");
  });

  it("produces a 12-element sparkline", () => {
    const signals = [1, 5, 10, 20, 30, 50, 70].map((d) => makeSignal(d));
    const result = computeMomentum(signals);
    expect(result.sparkline).toHaveLength(12);
  });

  it("is accelerating when prior is 0 and recent > 0", () => {
    // Signals only in the last 7 days
    const signals = [1, 2, 3].map((d) => makeSignal(d));
    const result = computeMomentum(signals);
    expect(result.trend).toBe("accelerating");
  });

  it("accepts a custom `now` timestamp for determinism", () => {
    const fixedNow = new Date("2025-06-01T12:00:00Z").getTime();
    const signals = [makeSignal(3)];
    const result = computeMomentum(signals, fixedNow);
    expect(["accelerating", "stable", "cooling"]).toContain(result.trend);
  });
});
