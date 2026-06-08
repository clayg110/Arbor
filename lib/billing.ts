// Stripe billing — dormant until STRIPE_SECRET_KEY is set (mirrors email/Sentry).
// getStripe() returns null when unconfigured; every billing route 503s in that
// case and orgs stay on the 'free' plan. Server-only (never import client-side).

import Stripe from "stripe";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/db";

export type Plan = "free" | "pro" | "enterprise";

export interface PlanDef {
  label: string;
  apiPerMin: number; // public-API rate limit for this tier
  priceEnv?: string; // env var holding the Stripe price id (paid plans only)
}

export const PLANS: Record<Plan, PlanDef> = {
  free: { label: "Free", apiPerMin: 60 },
  pro: { label: "Pro", apiPerMin: 300, priceEnv: "STRIPE_PRICE_PRO" },
  enterprise: {
    label: "Enterprise",
    apiPerMin: 1000,
    priceEnv: "STRIPE_PRICE_ENTERPRISE",
  },
};

// Subscription statuses that keep a paid plan's entitlements switched on.
const ACTIVE_STATUSES = new Set(["active", "trialing", "past_due"]);

// Statuses that warrant a payment-failed (dunning) notice to the org admins.
const DUNNING_STATUSES = new Set(["past_due", "unpaid"]);

export function isDunningStatus(status: string | null | undefined): boolean {
  return !!status && DUNNING_STATUSES.has(status);
}

// Admin emails for an org — the recipients of billing/dunning notices. Accepts
// the loose Supabase User shape (metadata is an open record).
export function dunningRecipients(
  users: {
    email?: string | null;
    app_metadata?: Record<string, unknown> | null;
    user_metadata?: Record<string, unknown> | null;
  }[],
  orgId: string
): string[] {
  return users
    .filter(
      (u) =>
        u.app_metadata?.["org_id"] === orgId &&
        u.user_metadata?.["role"] === "admin" &&
        !!u.email
    )
    .map((u) => u.email as string);
}

export function hasBillingEnv(): boolean {
  return !!process.env.STRIPE_SECRET_KEY;
}

let _stripe: Stripe | null | undefined;
export function getStripe(): Stripe | null {
  if (_stripe !== undefined) return _stripe;
  _stripe = process.env.STRIPE_SECRET_KEY
    ? new Stripe(process.env.STRIPE_SECRET_KEY)
    : null;
  return _stripe;
}

// Test seam — reset the memoized client when env is restubbed.
export function _resetStripe(): void {
  _stripe = undefined;
}

export function isPlan(v: unknown): v is Plan {
  return v === "free" || v === "pro" || v === "enterprise";
}

export function apiLimitForPlan(plan: string | null | undefined): number {
  return isPlan(plan) ? PLANS[plan].apiPerMin : PLANS.free.apiPerMin;
}

// Stripe price id → plan. Used by the webhook to map a subscription's price back
// to a tier. Returns "free" if the id matches no configured price.
export function planFromPrice(priceId: string | null | undefined): Plan {
  if (!priceId) return "free";
  if (priceId === process.env.STRIPE_PRICE_PRO) return "pro";
  if (priceId === process.env.STRIPE_PRICE_ENTERPRISE) return "enterprise";
  return "free";
}

type Svc = SupabaseClient<Database>;

// Effective plan for an org: the stored tier, downgraded to free if the
// subscription has lapsed (canceled / unpaid). NULL org → free.
export async function planForOrg(svc: Svc, orgId: string | null): Promise<Plan> {
  if (!orgId) return "free";
  const { data } = await svc
    .from("orgs")
    .select("plan, subscription_status")
    .eq("id", orgId)
    .maybeSingle();
  const row = data as { plan?: string; subscription_status?: string | null } | null;
  const plan = isPlan(row?.plan) ? row!.plan : "free";
  if (plan === "free") return "free";
  const status = row?.subscription_status ?? null;
  return status && ACTIVE_STATUSES.has(status) ? plan : "free";
}

// Find (or lazily create) the Stripe customer for an org, persisting the id.
export async function ensureCustomer(
  svc: Svc,
  stripe: Stripe,
  org: { id: string; name: string; stripe_customer_id?: string | null },
  email: string
): Promise<string> {
  if (org.stripe_customer_id) return org.stripe_customer_id;
  const customer = await stripe.customers.create({
    email,
    name: org.name,
    metadata: { org_id: org.id },
  });
  await svc.from("orgs").update({ stripe_customer_id: customer.id }).eq("id", org.id);
  return customer.id;
}
