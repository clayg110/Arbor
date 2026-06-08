import { type NextRequest } from "next/server";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/server";
import { ok, fail, requireBackend, serverError } from "@/lib/api/respond";
import { requireAdmin } from "@/lib/api/auth";
import { auditAs } from "@/lib/audit";
import { parseJson } from "@/lib/validation";
import { PLANS, getStripe, hasBillingEnv, ensureCustomer } from "@/lib/billing";
import type { DbOrg } from "@/types/db";

const schema = z.object({ plan: z.enum(["pro", "enterprise"]) });

// POST /api/billing/checkout — { plan } → Stripe Checkout url for the admin's org.
export async function POST(request: NextRequest) {
  const guard = requireBackend();
  if (guard) return guard;
  const gate = await requireAdmin();
  if (gate.res) return gate.res;

  if (!hasBillingEnv()) return fail("Billing not configured", 503);
  if (!gate.user.orgId) return fail("Create an organization before subscribing");

  const parsed = await parseJson(request, schema);
  if (!parsed.ok) return parsed.res;
  const plan = parsed.data.plan;

  const priceId = process.env[PLANS[plan].priceEnv!];
  if (!priceId) return fail(`No Stripe price configured for the ${plan} plan`, 503);

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
  if (!org) return fail("Organization not found", 404);

  try {
    const customer = await ensureCustomer(svc, stripe, org, gate.user.email);
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? request.nextUrl.origin;
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${appUrl}/admin?billing=success`,
      cancel_url: `${appUrl}/admin?billing=cancel`,
      client_reference_id: org.id,
      metadata: { org_id: org.id, plan },
      subscription_data: { metadata: { org_id: org.id } },
      allow_promotion_codes: true,
    });

    await auditAs(gate.user, "billing.checkout", {
      entityType: "org",
      entityId: org.id,
      metadata: { plan },
    });

    return ok({ url: session.url });
  } catch (e) {
    return serverError(e, "Could not start checkout");
  }
}
