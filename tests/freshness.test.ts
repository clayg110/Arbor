import { describe, it, expect } from "vitest";
import { evaluateFreshness } from "@/lib/freshness";

const now = Date.parse("2026-06-07T12:00:00Z");

describe("evaluateFreshness", () => {
  it("treats no signals as stale", () => {
    const f = evaluateFreshness(null, 24, now);
    expect(f.stale).toBe(true);
    expect(f.ageHours).toBeNull();
  });

  it("is fresh within the SLA window", () => {
    const oneHourAgo = new Date(now - 1 * 3_600_000).toISOString();
    const f = evaluateFreshness(oneHourAgo, 24, now);
    expect(f.stale).toBe(false);
    expect(f.ageHours).toBeCloseTo(1, 1);
  });

  it("is stale past the SLA window", () => {
    const thirtyHoursAgo = new Date(now - 30 * 3_600_000).toISOString();
    const f = evaluateFreshness(thirtyHoursAgo, 24, now);
    expect(f.stale).toBe(true);
    expect(f.ageHours).toBeCloseTo(30, 1);
  });
});
