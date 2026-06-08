import { describe, it, expect } from "vitest";
import { computeStatus, STATUS_LABEL } from "@/lib/status";

describe("computeStatus", () => {
  it("mock mode short-circuits to mock", () => {
    expect(computeStatus({ mode: "mock" })).toBe("mock");
    // mock wins even if other signals look bad
    expect(computeStatus({ mode: "mock", db: "error", freshnessStale: true })).toBe(
      "mock"
    );
  });

  it("operational when db ok, fresh, and all pipelines healthy", () => {
    expect(
      computeStatus({
        mode: "live",
        db: "ok",
        freshnessStale: false,
        pipelines: [{ ok: true }, { ok: true }],
      })
    ).toBe("operational");
  });

  it("degraded on db error", () => {
    expect(computeStatus({ mode: "live", db: "error" })).toBe("degraded");
  });

  it("degraded on stale data", () => {
    expect(computeStatus({ mode: "live", db: "ok", freshnessStale: true })).toBe(
      "degraded"
    );
  });

  it("degraded when any pipeline's latest run failed", () => {
    expect(
      computeStatus({ mode: "live", db: "ok", pipelines: [{ ok: true }, { ok: false }] })
    ).toBe("degraded");
  });

  it("has a label for every level", () => {
    expect(STATUS_LABEL.operational).toMatch(/operational/i);
    expect(STATUS_LABEL.degraded).toMatch(/degraded/i);
    expect(STATUS_LABEL.mock).toMatch(/mock/i);
  });
});
