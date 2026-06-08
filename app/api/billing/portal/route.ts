import { type NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { ok, fail, requireBackend, serverError } from "@/lib/api/respond";
import { requireAdmin } from "@/lib/api/auth";
import { getStripe, hasBillingEnv } from "@/lib/billing";
import type { DbOrg } from "@/types/db";

// POST /api/billing/portal — Stripe Billing Portal url for the admin's org.
export async function POST(request: NextRequest) {
  const guard = requireBackend();
  if (guard) return guard;
  const gate = await requireAdmin();
  if (gate.res) return gate.res;

  if (!hasBillingEnv()) return fail("Billing not configured", 503);
  if (!gate.user.orgId) return fail("No organization");

  const stripe = getStripe();
  if (!stripe) return fail("Billing not configured", 503);

  const svc = createServiceClient();
  const { data, error } = await svc
    .from("orgs")
    .select("*")
    .eq("id", gate.user.orgId)
    .maybeSingle();
  if (error) return serverError(error);
  const org = data as DbOrg | null;
  if (!org?.stripe_customer_id) return fail("No active billing customer");

  try {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? request.nextUrl.origin;
    const session = await stripe.billingPortal.sessions.create({
      customer: org.stripe_customer_id,
      return_url: `${appUrl}/admin`,
    });
    return ok({ url: session.url });
  } catch (e) {
    return serverError(e, "Could not open billing portal");
  }
}
