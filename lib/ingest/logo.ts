// Best-effort company logo lookup. Clearbit's free autocomplete endpoint maps a
// company name → domain + hosted logo URL (no API key). Returns null on any
// miss, timeout, or error — callers fall back to initials (see LogoBox). Set
// LOGO_API_DISABLED=1 to skip the lookup entirely.

interface ClearbitSuggestion {
  name: string;
  domain: string;
  logo: string;
}

export function logoLookupEnabled(): boolean {
  return process.env.LOGO_API_DISABLED !== "1";
}

export async function fetchLogoUrl(name: string): Promise<string | null> {
  if (!logoLookupEnabled()) return null;
  const q = name.trim();
  if (!q) return null;

  try {
    const res = await fetch(
      `https://autocomplete.clearbit.com/v1/companies/suggest?query=${encodeURIComponent(q)}`,
      { signal: AbortSignal.timeout(5000) }
    );
    if (!res.ok) return null;
    const list = (await res.json()) as ClearbitSuggestion[];
    const hit = Array.isArray(list) ? list[0] : null;
    if (!hit) return null;
    return hit.logo || (hit.domain ? `https://logo.clearbit.com/${hit.domain}` : null);
  } catch {
    return null;
  }
}
