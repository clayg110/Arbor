import { describe, it, expect } from "vitest";
import {
  computeMarketTiming,
  holdRipeness,
  bandFor,
  MARKET_TIMING_LABEL,
  MARKET_TIMING_COLOR,
  type MarketTimingInputs,
} from "@/lib/predict-market";

const base: MarketTimingInputs = {
  stage: "monitor_for_exit",
  dealType: "private_asset",
  daysInStage: 90,
  holdPeriodYears: 5,
};

describe("bandFor", () => {
  it("splits at 35 and 60", () => {
    expect(bandFor(0)).toBe("watch");
    expect(bandFor(34)).toBe("watch");
    expect(bandFor(35)).toBe("emerging");
    expect(bandFor(59)).toBe("emerging");
    expect(bandFor(60)).toBe("imminent");
    expect(bandFor(100)).toBe("imminent");
  });
});

describe("holdRipeness", () => {
  it("is low for a fresh hold and peaks across the 4–7yr window", () => {
    expect(holdRipeness(0.5)).toBeLessThan(holdRipeness(2));
    expect(holdRipeness(2)).toBeLessThan(holdRipeness(4));
    expect(holdRipeness(5)).toBe(1);
    expect(holdRipeness(7)).toBe(1);
  });

  it("eases but stays high once overdue (>7yr)", () => {
    expect(holdRipeness(9)).toBeGreaterThan(0.8);
    expect(holdRipeness(9)).toBeLessThan(1);
  });

  it("returns a neutral mid value when the hold is unknown", () => {
    expect(holdRipeness(undefined)).toBeCloseTo(0.4);
  });

  it("sharpens toward certainty near a known sponsor cadence", () => {
    // 3yr hold alone is mid-ramp; near a 3yr cadence it jumps to ~0.95.
    expect(holdRipeness(3)).toBeLessThan(0.95);
    expect(holdRipeness(3, 3)).toBeGreaterThanOrEqual(0.95);
  });
});

describe("computeMarketTiming", () => {
  it("an in-market asset is already here (score 100)", () => {
    const r = computeMarketTiming({ ...base, stage: "in_market" });
    expect(r.score).toBe(100);
    expect(r.band).toBe("imminent");
    expect(r.horizon).toMatch(/market/i);
  });

  it("a pulled process is dormant and floored low", () => {
    const r = computeMarketTiming({ ...base, stage: "pulled" });
    expect(r.score).toBeLessThanOrEqual(15);
    expect(r.band).toBe("watch");
    expect(r.drivers).toContain("Process pulled");
  });

  it("score stays within 0–100 even with everything maxed", () => {
    const r = computeMarketTiming({
      ...base,
      holdPeriodYears: 6,
      momentum: "accelerating",
      sectorHeat: 1,
      debtMaturityPressure: true,
      sponsorExitCadenceYears: 6,
    });
    expect(r.score).toBeLessThanOrEqual(100);
    expect(r.score).toBeGreaterThanOrEqual(0);
  });

  it("a ripe, accelerating, debt-pressured monitor deal is imminent", () => {
    const r = computeMarketTiming({
      ...base,
      holdPeriodYears: 6,
      momentum: "accelerating",
      debtMaturityPressure: true,
      sectorHeat: 0.7,
    });
    expect(r.band).toBe("imminent");
    expect(r.drivers.length).toBeGreaterThan(0);
  });

  it("ranks monitor_for_exit ahead of on_hold, all else equal", () => {
    const monitor = computeMarketTiming({ ...base, stage: "monitor_for_exit" }).score;
    const hold = computeMarketTiming({ ...base, stage: "on_hold" }).score;
    expect(monitor).toBeGreaterThan(hold);
  });

  it("a long-stalled hold scores below a recently parked one", () => {
    const fresh = computeMarketTiming({
      ...base,
      stage: "on_hold",
      daysInStage: 30,
    }).score;
    const stalled = computeMarketTiming({
      ...base,
      stage: "on_hold",
      daysInStage: 400,
    }).score;
    expect(fresh).toBeGreaterThan(stalled);
  });

  it("hold ripeness moves the score: a fresh hold scores below a ripe one", () => {
    const freshHold = computeMarketTiming({ ...base, holdPeriodYears: 1 }).score;
    const ripeHold = computeMarketTiming({ ...base, holdPeriodYears: 5 }).score;
    expect(ripeHold).toBeGreaterThan(freshHold);
  });

  it("accelerating momentum raises the score over cooling", () => {
    const hot = computeMarketTiming({ ...base, momentum: "accelerating" }).score;
    const cold = computeMarketTiming({ ...base, momentum: "cooling" }).score;
    expect(hot).toBeGreaterThan(cold);
  });

  it("debt-maturity pressure raises the score", () => {
    const without = computeMarketTiming({ ...base, debtMaturityPressure: false }).score;
    const withPressure = computeMarketTiming({
      ...base,
      debtMaturityPressure: true,
    }).score;
    expect(withPressure).toBeGreaterThan(without);
  });

  it("works on a bare row (stage + daysInStage only) without throwing", () => {
    const r = computeMarketTiming({
      stage: "monitor_for_exit",
      dealType: "carveout",
      daysInStage: 10,
    });
    expect(r.score).toBeGreaterThanOrEqual(0);
    expect(r.score).toBeLessThanOrEqual(100);
    expect(["imminent", "emerging", "watch"]).toContain(r.band);
  });

  it("surfaces hold-window and cadence drivers when warranted", () => {
    const r = computeMarketTiming({
      ...base,
      holdPeriodYears: 5,
      sponsorExitCadenceYears: 5,
    });
    expect(r.drivers.join(" ")).toMatch(/exit window/i);
    expect(r.drivers.length).toBeLessThanOrEqual(3);
  });

  it("flags an early hold as a driver", () => {
    const r = computeMarketTiming({ ...base, holdPeriodYears: 1, momentum: "cooling" });
    expect(r.drivers.join(" ")).toMatch(/early in hold/i);
  });

  it("exposes a label + AA color for every band", () => {
    for (const b of ["imminent", "emerging", "watch"] as const) {
      expect(MARKET_TIMING_LABEL[b]).toBeTruthy();
      expect(MARKET_TIMING_COLOR[b]).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
  });
});
