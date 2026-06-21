// Plan quotas + usage metering. The billing tiers (lib/billing.ts) define API
// rate limits; this adds the product quotas a customer actually feels — tracked
// companies, alert rules, seats — and turns a current count into a meter the
// settings UI renders (used / limit / how close to the ceiling). Pure + tested
// so the gating thresholds are auditable. `null` limit = unlimited.

import type { Plan } from "@/lib/billing";

export interface PlanQuota {
  companies: number | null;
  alertRules: number | null;
  seats: number | null;
}

// Kept in sync with the public pricing page. Enterprise is unlimited (null).
export const PLAN_QUOTAS: Record<Plan, PlanQuota> = {
  free: { companies: 50, alertRules: 3, seats: 3 },
  pro: { companies: 500, alertRules: 25, seats: 5 },
  enterprise: { companies: null, alertRules: null, seats: null },
};

export type UsageKey = "companies" | "alertRules" | "seats";

export const USAGE_LABEL: Record<UsageKey, string> = {
  companies: "Tracked companies",
  alertRules: "Alert rules",
  seats: "Team seats",
};

export type UsageState = "ok" | "warn" | "over";

export interface UsageMeter {
  key: UsageKey;
  label: string;
  used: number;
  limit: number | null; // null = unlimited
  ratio: number; // 0–1+ (0 when unlimited)
  remaining: number | null; // null = unlimited
  state: UsageState;
}

const WARN_AT = 0.8;
const KEY_ORDER: UsageKey[] = ["companies", "alertRules", "seats"];

export function planQuota(plan: Plan): PlanQuota {
  return PLAN_QUOTAS[plan] ?? PLAN_QUOTAS.free;
}

export function quotaLabel(limit: number | null): string {
  return limit == null ? "Unlimited" : String(limit);
}

function meterFor(key: UsageKey, used: number, limit: number | null): UsageMeter {
  if (limit == null) {
    return {
      key,
      label: USAGE_LABEL[key],
      used,
      limit: null,
      ratio: 0,
      remaining: null,
      state: "ok",
    };
  }
  const ratio = limit === 0 ? 1 : used / limit;
  const state: UsageState = used >= limit ? "over" : ratio >= WARN_AT ? "warn" : "ok";
  return {
    key,
    label: USAGE_LABEL[key],
    used,
    limit,
    ratio,
    remaining: Math.max(0, limit - used),
    state,
  };
}

// Build meters for whichever usage counts are supplied. A `seatLimit` override
// (from the Stripe subscription quantity) wins over the static quota for seats,
// since paid seats are sold per-subscription.
export function buildUsageMeters(
  plan: Plan,
  used: Partial<Record<UsageKey, number>>,
  opts: { seatLimit?: number | null } = {}
): UsageMeter[] {
  const quota = planQuota(plan);
  const meters: UsageMeter[] = [];
  for (const key of KEY_ORDER) {
    const u = used[key];
    if (u == null) continue;
    const limit =
      key === "seats" && opts.seatLimit !== undefined ? opts.seatLimit : quota[key];
    meters.push(meterFor(key, u, limit));
  }
  return meters;
}

// Whether one more of `key` is allowed under the plan (UI gating / upsell). A
// null (unlimited) quota is always within limit.
export function isWithinQuota(plan: Plan, key: UsageKey, currentCount: number): boolean {
  const limit = planQuota(plan)[key];
  return limit == null || currentCount < limit;
}

const UPGRADE: Record<Plan, Plan | null> = {
  free: "pro",
  pro: "enterprise",
  enterprise: null,
};

export function nextPlan(plan: Plan): Plan | null {
  return UPGRADE[plan];
}

// Client-safe plan display (label, price, one-line blurb). Kept here rather than
// in lib/billing.ts so the pricing UI can import it without pulling in Stripe.
export interface PlanDisplay {
  label: string;
  price: string;
  cadence: string;
  blurb: string;
}

export const PLAN_DISPLAY: Record<Plan, PlanDisplay> = {
  free: { label: "Free", price: "$0", cadence: "/mo", blurb: "For individual analysts" },
  pro: { label: "Pro", price: "$299", cadence: "/mo", blurb: "For active deal teams" },
  enterprise: {
    label: "Enterprise",
    price: "Custom",
    cadence: "",
    blurb: "For large coverage teams",
  },
};

// Headline feature bullets per plan for the pricing cards.
export const PLAN_FEATURES: Record<Plan, string[]> = {
  free: [
    `Up to ${quotaLabel(PLAN_QUOTAS.free.companies)} tracked companies`,
    `${quotaLabel(PLAN_QUOTAS.free.alertRules)} alert rules`,
    `${quotaLabel(PLAN_QUOTAS.free.seats)} seats`,
    "Radar, feed & deal rooms",
  ],
  pro: [
    `Up to ${quotaLabel(PLAN_QUOTAS.pro.companies)} tracked companies`,
    `${quotaLabel(PLAN_QUOTAS.pro.alertRules)} alert rules`,
    `${quotaLabel(PLAN_QUOTAS.pro.seats)} seats`,
    "AI memos, calibrated probability & comps",
    "Slack + email alerts",
  ],
  enterprise: [
    "Unlimited companies, alerts & seats",
    "SSO + SCIM provisioning",
    "Audit log + custom data sources",
    "SLA & dedicated support",
  ],
};
