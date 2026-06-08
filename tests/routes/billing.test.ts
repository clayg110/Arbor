import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { makeClient, installClient, fakeUser } from "../helpers/sb";

vi.mock("@/lib/supabase/server", () => ({
  hasSupabaseEnv: () => true,
  createClient: async () => (globalThis as Record<string, unknown>).__sb,
  createServiceClient: () => (globalThis as Record<string, unknown>).__sb,
}));
vi.mock("@/lib/audit", () => ({
  auditAs: vi.fn(async () => {}),
  logAudit: vi.fn(async () => {}),
}));
// Keep the pure helpers; control only the env gates + Stripe client.
vi.mock("@/lib/billing", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/billing")>();
  return { ...actual, hasBillingEnv: vi.fn(() => true), getStripe: vi.fn(() => ({})) };
});

import { POST as checkoutPOST } from "@/app/api/billing/checkout/route";
import { POST as portalPOST } from "@/app/api/billing/portal/route";
import { POST as webhookPOST } from "@/app/api/webhooks/stripe/route";
import { hasBillingEnv } from "@/lib/billing";

function nreq(
  url: string,
  body?: unknown,
  headers?: Record<string, string>
): NextRequest {
  return new NextRequest(url, {
    method: "POST",
    headers: { ...(body ? { "content-type": "application/json" } : {}), ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.mocked(hasBillingEnv).mockReturnValue(true);
});

describe("POST /api/billing/checkout (gating)", () => {
  beforeEach(() => installClient(makeClient({ user: fakeUser.admin })));

  it("401 when unauthenticated", async () => {
    installClient(makeClient({ user: null }));
    const res = await checkoutPOST(
      nreq("http://x/api/billing/checkout", { plan: "pro" })
    );
    expect(res.status).toBe(401);
  });

  it("403 for a non-admin", async () => {
    installClient(makeClient({ user: fakeUser.analyst }));
    const res = await checkoutPOST(
      nreq("http://x/api/billing/checkout", { plan: "pro" })
    );
    expect(res.status).toBe(403);
  });

  it("503 when billing is unconfigured", async () => {
    vi.mocked(hasBillingEnv).mockReturnValue(false);
    const res = await checkoutPOST(
      nreq("http://x/api/billing/checkout", { plan: "pro" })
    );
    expect(res.status).toBe(503);
  });
});

describe("POST /api/billing/portal (gating)", () => {
  beforeEach(() => installClient(makeClient({ user: fakeUser.admin })));

  it("403 for a non-admin", async () => {
    installClient(makeClient({ user: fakeUser.analyst }));
    const res = await portalPOST(nreq("http://x/api/billing/portal"));
    expect(res.status).toBe(403);
  });

  it("503 when billing is unconfigured", async () => {
    vi.mocked(hasBillingEnv).mockReturnValue(false);
    const res = await portalPOST(nreq("http://x/api/billing/portal"));
    expect(res.status).toBe(503);
  });
});

describe("POST /api/webhooks/stripe", () => {
  it("503 when billing is unconfigured", async () => {
    vi.mocked(hasBillingEnv).mockReturnValue(false);
    const res = await webhookPOST(nreq("http://x/api/webhooks/stripe", { id: "evt" }));
    expect(res.status).toBe(503);
  });

  it("400 when the stripe-signature header is missing", async () => {
    vi.mocked(hasBillingEnv).mockReturnValue(true);
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_test");
    const res = await webhookPOST(nreq("http://x/api/webhooks/stripe", { id: "evt" }));
    expect(res.status).toBe(400);
  });
});
