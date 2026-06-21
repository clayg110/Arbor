import { describe, it, expect } from "vitest";
import {
  PLAN_QUOTAS,
  buildUsageMeters,
  isWithinQuota,
  nextPlan,
  planQuota,
  quotaLabel,
} from "@/lib/usage";

describe("planQuota / quotaLabel", () => {
  it("free is the most constrained, enterprise is unlimited", () => {
    expect(PLAN_QUOTAS.free.companies).toBe(50);
    expect(PLAN_QUOTAS.pro.companies).toBe(500);
    expect(PLAN_QUOTAS.enterprise.companies).toBeNull();
  });

  it("labels unlimited quotas", () => {
    expect(quotaLabel(50)).toBe("50");
    expect(quotaLabel(null)).toBe("Unlimited");
  });

  it("falls back to free for an unknown plan", () => {
    // @ts-expect-error exercising the runtime fallback
    expect(planQuota("mystery")).toEqual(PLAN_QUOTAS.free);
  });
});

describe("buildUsageMeters", () => {
  it("builds a meter only for supplied counts, in a stable order", () => {
    const meters = buildUsageMeters("free", { companies: 10, alertRules: 1 });
    expect(meters.map((m) => m.key)).toEqual(["companies", "alertRules"]);
  });

  it("computes ratio and remaining against the plan quota", () => {
    const [m] = buildUsageMeters("free", { companies: 25 });
    expect(m!.limit).toBe(50);
    expect(m!.ratio).toBeCloseTo(0.5);
    expect(m!.remaining).toBe(25);
    expect(m!.state).toBe("ok");
  });

  it("flags warn at 80% and over at the limit", () => {
    expect(buildUsageMeters("free", { companies: 40 })[0]!.state).toBe("warn");
    expect(buildUsageMeters("free", { companies: 50 })[0]!.state).toBe("over");
    expect(buildUsageMeters("free", { companies: 60 })[0]!.state).toBe("over");
  });

  it("treats an unlimited (enterprise) quota as never over", () => {
    const [m] = buildUsageMeters("enterprise", { companies: 100_000 });
    expect(m!.limit).toBeNull();
    expect(m!.state).toBe("ok");
    expect(m!.ratio).toBe(0);
    expect(m!.remaining).toBeNull();
  });

  it("lets a subscription seat override beat the static quota", () => {
    const [m] = buildUsageMeters("pro", { seats: 7 }, { seatLimit: 10 });
    expect(m!.limit).toBe(10);
    expect(m!.state).toBe("ok");
  });
});

describe("isWithinQuota", () => {
  it("is false once the count reaches the limit", () => {
    expect(isWithinQuota("free", "alertRules", 2)).toBe(true);
    expect(isWithinQuota("free", "alertRules", 3)).toBe(false);
  });

  it("is always true for an unlimited quota", () => {
    expect(isWithinQuota("enterprise", "companies", 1_000_000)).toBe(true);
  });
});

describe("nextPlan", () => {
  it("walks free → pro → enterprise → none", () => {
    expect(nextPlan("free")).toBe("pro");
    expect(nextPlan("pro")).toBe("enterprise");
    expect(nextPlan("enterprise")).toBeNull();
  });
});
