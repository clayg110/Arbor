import { describe, it, expect, afterEach, vi } from "vitest";
import {
  hasBillingEnv,
  isPlan,
  apiLimitForPlan,
  planFromPrice,
  planForOrg,
  getStripe,
  _resetStripe,
  isDunningStatus,
  dunningRecipients,
  PLANS,
} from "@/lib/billing";
import { makeClient } from "./helpers/sb";

afterEach(() => {
  vi.unstubAllEnvs();
  _resetStripe();
});

describe("hasBillingEnv / getStripe", () => {
  it("is dormant (null) without a secret key", () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "");
    _resetStripe();
    expect(hasBillingEnv()).toBe(false);
    expect(getStripe()).toBeNull();
  });

  it("instantiates a memoized client when configured", () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_123");
    _resetStripe();
    expect(hasBillingEnv()).toBe(true);
    const a = getStripe();
    expect(a).not.toBeNull();
    expect(getStripe()).toBe(a); // memoized
  });
});

describe("isPlan / apiLimitForPlan", () => {
  it("recognizes the three tiers", () => {
    expect(isPlan("pro")).toBe(true);
    expect(isPlan("nope")).toBe(false);
    expect(isPlan(undefined)).toBe(false);
  });

  it("maps each plan to its public-API limit", () => {
    expect(apiLimitForPlan("free")).toBe(PLANS.free.apiPerMin);
    expect(apiLimitForPlan("pro")).toBe(300);
    expect(apiLimitForPlan("enterprise")).toBe(1000);
    expect(apiLimitForPlan("garbage")).toBe(60); // unknown → free
  });
});

describe("planFromPrice", () => {
  it("reverse-maps a Stripe price id to a plan", () => {
    vi.stubEnv("STRIPE_PRICE_PRO", "price_pro");
    vi.stubEnv("STRIPE_PRICE_ENTERPRISE", "price_ent");
    expect(planFromPrice("price_pro")).toBe("pro");
    expect(planFromPrice("price_ent")).toBe("enterprise");
    expect(planFromPrice("price_unknown")).toBe("free");
    expect(planFromPrice(null)).toBe("free");
  });
});

describe("isDunningStatus", () => {
  it("flags payment-failed statuses only", () => {
    expect(isDunningStatus("past_due")).toBe(true);
    expect(isDunningStatus("unpaid")).toBe(true);
    expect(isDunningStatus("active")).toBe(false);
    expect(isDunningStatus("canceled")).toBe(false);
    expect(isDunningStatus(null)).toBe(false);
  });
});

describe("dunningRecipients", () => {
  it("returns admin emails of the org only", () => {
    const users = [
      {
        email: "a@x.com",
        app_metadata: { org_id: "o1" },
        user_metadata: { role: "admin" },
      },
      {
        email: "b@x.com",
        app_metadata: { org_id: "o1" },
        user_metadata: { role: "analyst" },
      },
      {
        email: "c@x.com",
        app_metadata: { org_id: "o2" },
        user_metadata: { role: "admin" },
      },
      { email: null, app_metadata: { org_id: "o1" }, user_metadata: { role: "admin" } },
    ];
    expect(dunningRecipients(users, "o1")).toEqual(["a@x.com"]);
  });
});

describe("planForOrg", () => {
  it("returns free for a null org", async () => {
    expect(await planForOrg(makeClient() as never, null)).toBe("free");
  });

  it("honors an active paid subscription", async () => {
    const svc = makeClient({
      result: { data: { plan: "pro", subscription_status: "active" } },
    });
    expect(await planForOrg(svc as never, "org-1")).toBe("pro");
  });

  it("downgrades a lapsed subscription to free", async () => {
    const svc = makeClient({
      result: { data: { plan: "pro", subscription_status: "canceled" } },
    });
    expect(await planForOrg(svc as never, "org-1")).toBe("free");
  });

  it("treats a free-plan row as free", async () => {
    const svc = makeClient({ result: { data: { plan: "free" } } });
    expect(await planForOrg(svc as never, "org-1")).toBe("free");
  });
});
