// Google Custom Search per tracked private-asset company. Requires
// GOOGLE_CUSTOM_SEARCH_API_KEY + GOOGLE_CUSTOM_SEARCH_ENGINE_ID; returns [] when
// unconfigured (pipeline still runs on RSS).

import { withRetry, throwIfRetryableStatus } from "@/lib/retry";

export interface WebSignal {
  rawText: string;
  sourceUrl: string;
  sourceName: string;
  docType: string;
}

export function hasGoogleEnv(): boolean {
  return (
    !!process.env.GOOGLE_CUSTOM_SEARCH_API_KEY &&
    !!process.env.GOOGLE_CUSTOM_SEARCH_ENGINE_ID
  );
}

interface CseItem {
  title?: string;
  snippet?: string;
  link?: string;
  displayLink?: string;
}

async function cseSearch(query: string, limit: number): Promise<WebSignal[]> {
  if (!hasGoogleEnv()) return [];
  const url =
    `https://www.googleapis.com/customsearch/v1` +
    `?key=${process.env.GOOGLE_CUSTOM_SEARCH_API_KEY}` +
    `&cx=${process.env.GOOGLE_CUSTOM_SEARCH_ENGINE_ID}` +
    `&q=${encodeURIComponent(query)}&num=${limit}`;
  try {
    const res = await withRetry(
      async () =>
        throwIfRetryableStatus(await fetch(url, { signal: AbortSignal.timeout(10000) })),
      { retries: 2, baseMs: 400 }
    );
    if (!res.ok) return [];
    const json = (await res.json()) as { items?: CseItem[] };
    return (json.items ?? []).slice(0, limit).map((it) => ({
      rawText: `${it.title ?? ""}. ${it.snippet ?? ""}`.trim(),
      sourceUrl: it.link ?? "#",
      sourceName: it.displayLink ?? "Google News",
      docType: "News article",
    }));
  } catch {
    return [];
  }
}

// Private-asset exit signals (sponsor selling a portfolio company).
export function fetchCompanyWebSignals(name: string, limit = 3): Promise<WebSignal[]> {
  return cseSearch(
    `"${name}" AND ("sale process" OR "strategic alternatives" OR "private equity exit" OR "acquisition" OR "LOI")`,
    limit
  );
}

// Corporate-divestiture / carve-out signals (a parent shedding a unit).
export function fetchDivestitureSignals(name: string, limit = 2): Promise<WebSignal[]> {
  return cseSearch(
    `"${name}" AND ("divest" OR "carve-out" OR "carve out" OR "strategic alternatives" OR "exploring a sale" OR "to sell" OR "spin off")`,
    limit
  );
}
