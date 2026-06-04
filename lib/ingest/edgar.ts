// SEC EDGAR full-text search → recent filing text. No key required, but SEC
// requires a descriptive User-Agent (set SEC_USER_AGENT).

export interface Filing {
  rawText: string;
  sourceUrl: string;
  sourceName: string;
  docType: string;
}

const UA = process.env.SEC_USER_AGENT ?? "Arbor Research arbor@example.com";

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#\d+;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

interface EftsHit {
  _id?: string; // "0000000000-00-000000:document.htm"
  _source?: {
    display_names?: string[];
    ciks?: string[];
    file_type?: string;
    root_forms?: string[];
  };
}

// Recent carveout/divestiture filings (default last 6h, top 10).
export async function fetchRecentCarveoutFilings(
  hoursBack = 6,
  limit = 10
): Promise<Filing[]> {
  const startdt = new Date(Date.now() - hoursBack * 3_600_000).toISOString().slice(0, 10);
  const enddt = new Date().toISOString().slice(0, 10);
  const q = encodeURIComponent('"strategic alternatives" OR "divestiture" OR "carve-out"');
  const url = `https://efts.sec.gov/LATEST/search-index?q=${q}&startdt=${startdt}&enddt=${enddt}&forms=8-K`;

  let json: { hits?: { hits?: EftsHit[] } };
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" } });
    if (!res.ok) return [];
    json = await res.json();
  } catch {
    return [];
  }

  const hits = json.hits?.hits ?? [];
  const out: Filing[] = [];

  for (const h of hits.slice(0, limit)) {
    const id = h._id ?? "";
    const [accession, filename] = id.split(":");
    const cik = h._source?.ciks?.[0];
    if (!cik || !accession || !filename) continue;

    const acc = accession.replace(/-/g, "");
    const docUrl = `https://www.sec.gov/Archives/edgar/data/${Number(cik)}/${acc}/${filename}`;

    let text = "";
    try {
      const d = await fetch(docUrl, { headers: { "User-Agent": UA } });
      if (d.ok) text = stripHtml(await d.text()).slice(0, 6000);
    } catch {
      // keep going with metadata-only text
    }

    out.push({
      rawText: text || (h._source?.display_names?.join(" ") ?? ""),
      sourceUrl: docUrl,
      sourceName: "SEC EDGAR",
      docType: `${h._source?.file_type ?? "8-K"} filing`,
    });
  }

  return out;
}
