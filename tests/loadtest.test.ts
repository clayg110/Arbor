import { describe, it, expect } from "vitest";
// The load-test math lives in a plain .mjs so the runner has no build step;
// vitest imports it directly.
import { percentile, summarize, evaluateLoad } from "../scripts/load/budget.mjs";

describe("percentile (nearest-rank)", () => {
  const xs = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  it("returns 0 for an empty set", () => {
    expect(percentile([], 95)).toBe(0);
  });
  it("computes common percentiles", () => {
    expect(percentile(xs, 50)).toBe(5);
    expect(percentile(xs, 95)).toBe(10);
    expect(percentile(xs, 100)).toBe(10);
  });
});

describe("summarize", () => {
  it("rolls samples + errors into headline stats", () => {
    const s = summarize([10, 20, 30, 40], 1, 1000);
    expect(s.requests).toBe(5); // 4 ok + 1 error
    expect(s.errors).toBe(1);
    expect(s.errorRate).toBeCloseTo(0.2, 5);
    expect(s.rps).toBeCloseTo(5, 5); // 5 reqs / 1000ms * 1000
    expect(s.p50).toBe(20);
    expect(s.max).toBe(40);
  });

  it("is safe on an all-error run (no samples)", () => {
    const s = summarize([], 3, 1000);
    expect(s.requests).toBe(3);
    expect(s.errorRate).toBe(1);
    expect(s.p95).toBe(0);
  });
});

describe("evaluateLoad", () => {
  const good = { p50: 50, p95: 200, p99: 400, errorRate: 0 };

  it("passes within budget", () => {
    expect(evaluateLoad(good, { p95: 500, p99: 1000, errorRate: 0.01 })).toEqual({
      pass: true,
      failures: [],
    });
  });

  it("flags each breached dimension", () => {
    const r = evaluateLoad(
      { p95: 800, p99: 1500, errorRate: 0.05 },
      { p95: 500, p99: 1000, errorRate: 0.01 }
    );
    expect(r.pass).toBe(false);
    expect(r.failures).toHaveLength(3);
    expect(r.failures[0]).toContain("p95");
    expect(r.failures[2]).toContain("error rate");
  });

  it("ignores budget dimensions left undefined", () => {
    expect(evaluateLoad({ p95: 9999, p99: 9999, errorRate: 1 }, {}).pass).toBe(true);
  });
});
