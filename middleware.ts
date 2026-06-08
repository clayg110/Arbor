import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { buildCsp } from "@/lib/csp";

export async function middleware(request: NextRequest) {
  // Correlation id: reuse an inbound one (proxy / client) or mint a fresh one.
  // Forwarded on the request (route handlers + logs read it) and echoed on the
  // response so clients can quote it in bug reports.
  const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();
  request.headers.set("x-request-id", requestId);

  // CSP: app pages get a per-request nonce + strict-dynamic. The static landing
  // page can't nonce its inline scripts, so it falls back to a relaxed policy.
  const isLanding = request.nextUrl.pathname.startsWith("/landing");
  const nonce = isLanding ? null : Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = buildCsp(nonce, process.env.NODE_ENV !== "production");
  // Setting these on the REQUEST lets Next stamp the nonce onto its own <script>
  // tags; echoing on the response enforces the policy in the browser.
  if (nonce) request.headers.set("x-nonce", nonce);
  request.headers.set("content-security-policy", csp);

  const res = await updateSession(request);
  res.headers.set("x-request-id", requestId);
  res.headers.set("content-security-policy", csp);
  return res;
}

export const config = {
  // Skip Next internals, static assets, cron ingestion routes (CRON_SECRET), the
  // public API (api/v1 — bearer key), the health/status probes (public) and
  // Stripe webhooks (api/webhooks — signature-verified, no session).
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/ingest|api/cron|api/v1|api/scim|api/health|api/status|api/webhooks|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|html)$).*)",
  ],
};
