/** @type {import('next').NextConfig} */

const isDev = process.env.NODE_ENV !== "production";

// Content Security Policy. 'unsafe-inline' is required for Next's hydration
// inline scripts and the app's inline styles; 'unsafe-eval' is dev-only (React
// Refresh). connect-src allows Supabase REST + realtime (wss); img-src allows
// remote company logos; style/font-src allow the landing page's CDN fonts/icons.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net",
  "font-src 'self' data: https://fonts.gstatic.com https://cdn.jsdelivr.net",
  "img-src 'self' data: https:",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), browsing-topics=()" },
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

export default nextConfig;
