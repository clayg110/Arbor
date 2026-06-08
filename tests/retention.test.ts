import { describe, it, expect, afterEach, vi } from "vitest";
import { cutoffIso, retentionDays, purgeExpired } from "@/lib/retention";
import { makeClient } from "./helpers/sb";

afterEach(() => vi.unstubAllEnvs());

describe("cutoffIso", () => {
  const now = Date.parse("2026-06-07T00:00:00Z");
  it("returns the timestamp N days before now", () => {
    expect(cutoffIso(1, now)).toBe("2026-06-06T00:00:00.000Z");
  });
  it("is earlier for a larger window", () => {
    expect(cutoffIso(90, now) < cutoffIso(30, now)).toBe(true);
  });
});

describe("retentionDays", () => {
  it("uses defaults", () => {
    expect(retentionDays()).toEqual({
      deadletter: 30,
      usage: 180,
      runs: 90,
      orphanSignals: 365,
    });
  });
  it("honors env overrides + ignores invalid", () => {
    vi.stubEnv("RETAIN_DEADLETTER_DAYS", "7");
    vi.stubEnv("RETAIN_RUNS_DAYS", "-5"); // invalid → default
    const d = retentionDays();
    expect(d.deadletter).toBe(7);
    expect(d.runs).toBe(90);
  });
});

describe("purgeExpired", () => {
  it("deletes from every retained table and returns counts", async () => {
    const svc = makeClient({ result: { count: 3, error: null } });
    const out = await purgeExpired(svc as never, Date.parse("2026-06-07T00:00:00Z"));
    expect(out).toEqual({
      signal_failures: 3,
      llm_usage: 3,
      pipeline_runs: 3,
      signals_raw: 3,
    });
  });
});
