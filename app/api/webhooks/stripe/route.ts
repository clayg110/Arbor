import { type NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { createServiceClient } from "@/lib/supabase/server";
import {
  getStripe,
  hasBillingEnv,
  planFromPrice,
  isDunningStatus,
  dunningRecipients,
} from "@/lib/billing";
import { hasEmailEnv, sendEmail, dunningEmail } from "@/lib/email";
import { logAudit } from "@/lib/audit";
import { captureException } from "@/lib/observability";
import { log } from "@/lib/logger";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/db";

// Stripe needs the raw, unparsed body to verify the signature.
export const dynamic = "force-dynamic";

type Svc = SupabaseClient<Database>;

// Mirror a subscription's state onto the owning org (matched by customer id).
// On a transition into a payment-failed state, email the org's admins.
async function applySubscription(
  svc: Svc,
  sub: Stripe.Subscription,
  appUrl: string
): Promise<void> {
  const customer = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
  const item = sub.items.data[0];
  const periodEnd = (item as { current_period_end?: number } | undefined)
    ?.current_period_end;

  // Read current state first so we only dun on an actual status transition.
  const { data: before } = await svc
    .from("orgs")
    .select("id, name, subscription_status")
    .eq("stripe_customer_id", customer)
    .maybeSingle();
  const org = before as {
    id: string;
    name: string;
    subscription_status: string | null;
  } | null;

  await svc
    .from("orgs")
    .update({
      plan: planFromPrice(item?.price?.id),
      subscription_status: sub.status,
      stripe_subscription_id: sub.id,
      seats: item?.quantity ?? 1,
      current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
    })
    .eq("stripe_customer_id", customer);

  if (
    org &&
    hasEmailEnv() &&
    isDunningStatus(sub.status) &&
    org.subscription_status !== sub.status
  ) {
    const { data: list } = await svc.auth.admin.listUsers();
    const mail = dunningEmail({
      orgName: org.name,
      status: sub.status,
      manageUrl: `${appUrl}/admin`,
    });
    for (const to of dunningRecipients(list?.users ?? [], org.id)) {
      await sendEmail({ to, ...mail });
    }
  }
}

// POST /api/webhooks/stripe — Stripe subscription lifecycle → org plan state.
// Public route (no session); authenticity comes from the signature.
export async function POST(request: NextRequest) {
  if (!hasBillingEnv() || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Billing not configured" }, { status: 503 });
  }
  const stripe = getStripe();
  if (!stripe)
    return NextResponse.json({ error: "Billing not configured" }, { status: 503 });

  const sig = request.headers.get("stripe-signature");
  if (!sig) return NextResponse.json({ error: "Missing signature" }, { status: 400 });

  const raw = await request.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(raw, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (e) {
    log.warn("stripe webhook signature verification failed", {
      msg: e instanceof Error ? e.message : String(e),
    });
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const svc = createServiceClient();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? request.nextUrl.origin;
  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const s = event.data.object as Stripe.Checkout.Session;
        const orgId = s.client_reference_id;
        const customerId = typeof s.customer === "string" ? s.customer : s.customer?.id;
        if (orgId && customerId) {
          await svc
            .from("orgs")
            .update({ stripe_customer_id: customerId })
            .eq("id", orgId);
        }
        if (s.subscription) {
          const subId =
            typeof s.subscription === "string" ? s.subscription : s.subscription.id;
          const sub = await stripe.subscriptions.retrieve(subId);
          await applySubscription(svc, sub, appUrl);
        }
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        await applySubscription(svc, event.data.object as Stripe.Subscription, appUrl);
        break;
      }
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const customer =
          typeof sub.customer === "string" ? sub.customer : sub.customer.id;
        await svc
          .from("orgs")
          .update({
            plan: "free",
            subscription_status: "canceled",
            stripe_subscription_id: null,
          })
          .eq("stripe_customer_id", customer);
        break;
      }
      default:
        // ignore unhandled event types
        break;
    }

    void logAudit({ action: `stripe.${event.type}`, entityType: "billing" });
    return NextResponse.json({ received: true });
  } catch (e) {
    // 500 → Stripe retries with backoff.
    captureException(e, { scope: "stripe-webhook", type: event.type });
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }
}
