// Enterprise SSO helper. Maps a work email (or bare domain) to the SSO domain
// Supabase uses to look up the org's SAML provider. Pure + validated.

export function domainFromEmail(input: string): string | null {
  const s = (input ?? "").trim().toLowerCase();
  if (!s) return null;
  const at = s.indexOf("@");
  const domain = at >= 0 ? s.slice(at + 1) : s;
  // basic hostname shape: labels + a 2+ char TLD, no spaces
  if (!/^[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/.test(domain)) return null;
  return domain;
}
