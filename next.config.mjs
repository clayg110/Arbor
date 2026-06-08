import { withSentryConfig } from "@sentry/nextjs";

/** @type {import('next').NextConfig} */

// Content-Security-Policy is set per-request in middleware (lib/csp.ts) so app
// pages get a nonce + strict-dynamic. The remaining headers are static + global.
const securityHeaders = [
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Isolate our browsing context from cross-origin window references (Spectre /
  // tab-nabbing hardening). Safe here — we open no cross-origin popups we talk to.
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
  },
  { key: "X-DNS-Prefetch-Control", value: "off" },
];

const nextConfig = {
  poweredByHeader: false, // drop the X-Powered-By: Next.js fingerprint

  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },

  // Clean URL for the standalone marketing page (static file in /public).
  async rewrites() {
    return [{ source: "/landing", destination: "/landing.html" }];
  },
};

// Wrap with Sentry to upload source maps (readable stack traces) on builds where
// SENTRY_AUTH_TOKEN + org + project are set. A no-op for uploads otherwise — the
// build still succeeds without any Sentry env.
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: true,
  widenClientFileUpload: true,
  disableLogger: true,
});
