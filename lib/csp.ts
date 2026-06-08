// Content-Security-Policy builder. App HTML pages get a per-request nonce +
// strict-dynamic (no script 'unsafe-inline' → real XSS hardening); the static
// landing page (whose inline scripts can't be nonced) falls back to a relaxed
// policy. style-src keeps 'unsafe-inline' because the app uses inline style
// ATTRIBUTES, which nonces don't cover. Dev adds 'unsafe-eval' for React Refresh.

export function buildCsp(nonce: string | null, isDev: boolean): string {
  const evalForDev = isDev ? " 'unsafe-eval'" : "";
  const scriptSrc = nonce
    ? `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${evalForDev}`
    : `script-src 'self' 'unsafe-inline'${evalForDev}`;

  return [
    "default-src 'self'",
    scriptSrc,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net",
    "font-src 'self' data: https://fonts.gstatic.com https://cdn.jsdelivr.net",
    "img-src 'self' data: https:",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
    // Cloudflare Turnstile renders its challenge in an iframe (dormant until a
    // site key is set; the directive is harmless when the widget is absent).
    "frame-src 'self' https://challenges.cloudflare.com",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ].join("; ");
}
