import { describe, it, expect } from "vitest";
import {
  buildCalibration,
  probabilityToClose,
  basisLabel,
  DEFAULT_CALIBRATION,
  HISTORICAL_OUTCOMES,
  type OutcomeSample,
} from "@/lib/calibration";

describe("buildCalibration", () => {
  it("tallies wins/resolved per conviction band", () => {
    const samples: OutcomeSample[] = [
      { convictionScore: 80, won: true }, // hot
      { convictionScore: 70, won: false }, // hot
      { convictionScore: 50, won: true }, // warm
      { convictionScore: 20, won: false }, // cold
    ];
    const m = buildCalibration(samples);
    expect(m.totalResolved).toBe(4);
    expect(m.bands.hot.resolved).toBe(2);
    expect(m.bands.hot.won).toBe(1);
    expect(m.bands.warm.resolved).toBe(1);
    expect(m.bands.cold.resolved).toBe(1);
  });

  it("reports the raw empirical rate per band", () => {
    const m = buildCalibration([
      { convictionScore: 90, won: true },
      { convictionScore: 85, won: true },
      { convictionScore: 80, won: false },
      { convictionScore: 75, won: false },
    ]);
    expect(m.bands.hot.empiricalRate).toBe(50); // 2 of 4
  });

  it("smooths small samples toward the prior (no 0%/100% swings)", () => {
    // A single hot win would be 100% empirically; smoothing keeps it sane.
    const m = buildCalibration([{ convictionScore: 90, won: true }]);
    expect(m.bands.hot.empiricalRate).toBe(100);
    expect(m.bands.hot.smoothedRate).toBeLessThan(80);
    expect(m.bands.hot.smoothedRate).toBeGreaterThan(40);
  });

  it("falls back to the prior for a band with no samples", () => {
    const m = buildCalibration([{ convictionScore: 90, won: true }]);
    expect(m.bands.cold.resolved).toBe(0);
    // cold prior is 12% → smoothed equals the prior exactly with no data
    expect(m.bands.cold.smoothedRate).toBe(12);
  });

  it("lets a large empirical sample dominate the prior", () => {
    const m = buildCalibration(
      Array.from({ length: 100 }, () => ({
        convictionScore: 90,
        won: true,
      }))
    );
    expect(m.bands.hot.smoothedRate).toBeGreaterThan(90);
  });
});

describe("probabilityToClose", () => {
  it("maps a score to its band's smoothed rate with sample size + basis", () => {
    const p = probabilityToClose(85, DEFAULT_CALIBRATION);
    expect(p.band).toBe("hot");
    expect(p.pct).toBeGreaterThan(0);
    expect(p.pct).toBeLessThanOrEqual(100);
    expect(p.sampleSize).toBe(DEFAULT_CALIBRATION.bands.hot.resolved);
  });

  it("ranks hot > warm > cold probabilities under the default model", () => {
    const hot = probabilityToClose(85).pct;
    const warm = probabilityToClose(50).pct;
    const cold = probabilityToClose(15).pct;
    expect(hot).toBeGreaterThan(warm);
    expect(warm).toBeGreaterThan(cold);
  });

  it("flags basis as empirical when the band is well-sampled", () => {
    const p = probabilityToClose(85, DEFAULT_CALIBRATION);
    expect(p.basis).toBe("empirical");
  });

  it("flags basis as prior when the band has no comparables", () => {
    const sparse = buildCalibration([{ convictionScore: 90, won: true }]);
    const p = probabilityToClose(15, sparse); // cold band, zero samples
    expect(p.basis).toBe("prior");
    expect(basisLabel(p)).toMatch(/model estimate/i);
  });

  it("defaults to the bundled model when none is passed", () => {
    expect(probabilityToClose(85).pct).toBe(DEFAULT_CALIBRATION.bands.hot.smoothedRate);
  });
});

describe("DEFAULT_CALIBRATION", () => {
  it("is built from the bundled history and is roughly calibrated", () => {
    expect(DEFAULT_CALIBRATION.totalResolved).toBe(HISTORICAL_OUTCOMES.length);
    // hot history is ~65% wins; smoothed should land in a believable hot range
    expect(DEFAULT_CALIBRATION.bands.hot.smoothedRate).toBeGreaterThan(50);
    expect(DEFAULT_CALIBRATION.bands.cold.smoothedRate).toBeLessThan(25);
  });

  it("gives every band a label", () => {
    for (const score of [85, 50, 15]) {
      expect(basisLabel(probabilityToClose(score))).toBeTruthy();
    }
  });
});
