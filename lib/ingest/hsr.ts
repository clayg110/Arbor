// HSR (Hart-Scott-Rodino) pre-merger filing fetcher. Dormant without
// HSR_SOURCE_URL. FTC publishes these publicly — no API key required.

export interface HsrFiling {
  transactionId: string;
  acquirer: string;
  target: string;
  filedDate: string; // ISO YYYY-MM-DD
  sourceUrl: string;
}

export function hasHsrEnv(): boolean {
  return !!process.env.HSR_SOURCE_URL;
}

// Parse FTC title format: "Acquirer Corp / Target Inc" or plain name.
export function parseFilingTitle(
  title: string
): { acquirer: string; target: string } | null {
  if (!title.trim()) return null;
  const slash = title.indexOf(" / ");
  if (slash !== -1) {
    return {
      acquirer: title.slice(0, slash).trim(),
      target: title.slice(slash + 3).trim(),
    };
  }
  // Bare title — treat as target only (no acquirer known).
  return { acquirer: "", target: title.trim() };
}

// Parse FTC Elasticsearch-style JSON response.
export function parseHsrResponse(raw: unknown, baseUrl: string): HsrFiling[] {
  if (!raw || typeof raw !== "object") return [];
  const r = raw as Record<string, unknown>;
  const outer = r["hits"] as Record<string, unknown> | undefined;
  const hits = outer?.["hits"];
  if (!Array.isArray(hits)) return [];

  const result: HsrFiling[] = [];
  for (const h of hits) {
    const src = (h as Record<string, unknown>)["_source"] as
      | Record<string, unknown>
      | undefined;
    if (!src) continue;

    const title = typeof src["title"] === "string" ? src["title"] : "";
    const date =
      typeof src["date"] === "string"
        ? src["date"].slice(0, 10)
        : new Date().toISOString().slice(0, 10);
    const txId =
      typeof src["transaction_number"] === "string"
        ? src["transaction_number"]
        : String(result.length + 1);

    const parsed = parseFilingTitle(title);
    if (!parsed) continue;

    result.push({
      transactionId: txId,
      acquirer: parsed.acquirer,
      target: parsed.target,
      filedDate: date,
      sourceUrl: `${baseUrl}/${txId}`,
    });
  }
  return result;
}

export async function fetchHsrFilings(daysBack = 30): Promise<HsrFiling[]> {
  const url = process.env.HSR_SOURCE_URL;
  if (!url) return [];

  const from = new Date(Date.now() - daysBack * 86_400_000).toISOString().slice(0, 10);
  const to = new Date().toISOString().slice(0, 10);

  const res = await fetch(`${url}?from=${from}&to=${to}`, {
    headers: { Accept: "application/json" },
    // always fresh — filings are new each day
    cache: "no-store",
  });
  if (!res.ok) return [];

  const json: unknown = await res.json();
  return parseHsrResponse(json, url);
}
