import { describe, it, expect } from "vitest";
import {
  computeConviction,
  bandFor,
  CONVICTION_LABEL,
  CONVICTION_COLOR,
  type ConvictionInputs,
} from "@/lib/conviction";

const base: ConvictionInputs = {
  lastSignalAgeDays: 2,
  confidence: "high",
  stage: "in_market",
  signalCount30d: 3,
  distinctSourceTypes: 2,
};

describe("bandFor", () => {
  it("splits at 34 and 67", () => {
    expect(bandFor(0)).toBe("cold");
    expect(bandFor(33)).toBe("cold");
    expect(bandFor(34)).toBe("warm");
    expect(bandFor(66)).toBe("warm");
    expect(bandFor(67)).toBe("hot");
    expect(bandFor(100)).toBe("hot");
  });
});

describe("computeConviction", () => {
  it("a fresh, multi-source, high-confidence in-market deal is hot", () => {
    const r = computeConviction(base);
    expect(r.score).toBeGreaterThanOrEqual(67);
    expect(r.band).toBe("hot");
  });

  it("score stays within 0–100", () => {
    expect(computeConviction(base).score).toBeLessThanOrEqual(100);
    expect(
      computeConviction({
        lastSignalAgeDays: 99999,
        confidence: "needs_review",
        stage: "on_hold",
        signalCount30d: 0,
        distinctSourceTypes: 0,
      }).score
    ).toBeGreaterThanOrEqual(0);
  });

  it("recency dominates: a stale signal scores lower than a fresh one, all else equal", () => {
    const fresh = computeConviction({ ...base, lastSignalAgeDays: 1 });
    const stale = computeConviction({ ...base, lastSignalAgeDays: 45 });
    expect(fresh.score).toBeGreaterThan(stale.score);
  });

  it("stage proximity matters: in_market > monitor > on_hold", () => {
    const im = computeConviction({ ...base, stage: "in_market" }).score;
    const mon = computeConviction({ ...base, stage: "monitor_for_exit" }).score;
    const hold = computeConviction({ ...base, stage: "on_hold" }).score;
    expect(im).toBeGreaterThan(mon);
    expect(mon).toBeGreaterThan(hold);
  });

  it("higher confidence scores higher", () => {
    const hi = computeConviction({ ...base, confidence: "high" }).score;
    const lo = computeConviction({ ...base, confidence: "needs_review" }).score;
    expect(hi).toBeGreaterThan(lo);
  });

  it("more signals + more distinct sources raise the score", () => {
    const thin = computeConviction({
      ...base,
      signalCount30d: 1,
      distinctSourceTypes: 1,
    }).score;
    const thick = computeConviction({
      ...base,
      signalCount30d: 5,
      distinctSourceTypes: 3,
    }).score;
    expect(thick).toBeGreaterThan(thin);
  });

  it("a pulled deal is floored to cold even with fresh, strong signals", () => {
    const r = computeConviction({ ...base, stage: "pulled" });
    expect(r.score).toBeLessThanOrEqual(20);
    expect(r.band).toBe("cold");
  });

  it("defaults signal aggregates from the presence of a last signal", () => {
    const withSignal = computeConviction({
      lastSignalAgeDays: 3,
      confidence: "medium",
      stage: "monitor_for_exit",
    });
    const noSignal = computeConviction({
      lastSignalAgeDays: 99999,
      confidence: "medium",
      stage: "monitor_for_exit",
    });
    expect(withSignal.score).toBeGreaterThan(noSignal.score);
  });

  it("exposes a label + color for every band", () => {
    for (const b of ["hot", "warm", "cold"] as const) {
      expect(CONVICTION_LABEL[b]).toBeTruthy();
      expect(CONVICTION_COLOR[b]).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
  });
});
