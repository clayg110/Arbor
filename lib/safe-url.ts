// Guards user-supplied URLs that get rendered into `href`. A value like
// "javascript:alert(1)" or "data:text/html,…" in an anchor href executes on
// click — a stored-XSS vector — so anything that isn't http(s) is rejected.
// Pure, dependency-free; safe to use in both server validation and client render.

// Normalize a user URL to a safe absolute http(s) URL, or null if it can't be
// one. Schemeless input ("linkedin.com/in/x") is treated as https. Any explicit
// non-http(s) scheme (javascript:, data:, file:, mailto:…) returns null.
export function safeHttpUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const hasScheme = /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed);
  try {
    const url = new URL(hasScheme ? trimmed : `https://${trimmed}`);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

// True when `value` is empty/absent or normalizes to a safe http(s) URL — the
// predicate form for optional URL fields in zod schemas.
export function isSafeOptionalUrl(value: string | null | undefined): boolean {
  return !value || value.trim() === "" || safeHttpUrl(value) !== null;
}
