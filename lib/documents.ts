// Deal document attachments (teasers, CIMs, financials). Pure helpers only — the
// binary lives in Supabase Storage, the row in `documents`. The headline value is
// extractFinancials: pull stated revenue / EBITDA / margin / multiple out of a
// document's text so they can seed comps + conviction without manual entry.
// Regex-based and conservative — it reports only figures it can tie to a keyword,
// with the matched snippet as evidence. No I/O.

export type DocumentKind = "teaser" | "cim" | "financials" | "other";

export const DOCUMENT_KINDS: DocumentKind[] = ["teaser", "cim", "financials", "other"];

export const DOCUMENT_KIND_LABELS: Record<DocumentKind, string> = {
  teaser: "Teaser",
  cim: "CIM",
  financials: "Financials",
  other: "Other",
};

export const MAX_DOCUMENT_BYTES = 25 * 1024 * 1024; // 25 MB

export const ALLOWED_CONTENT_TYPES = new Set<string>([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // xlsx
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // docx
  "application/msword",
  "text/plain",
  "text/csv",
  "text/markdown",
]);

export function isDocumentKind(v: unknown): v is DocumentKind {
  return typeof v === "string" && (DOCUMENT_KINDS as string[]).includes(v);
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export interface UploadCheck {
  ok: boolean;
  error?: string;
}

export function validateUpload(file: {
  name: string;
  sizeBytes: number;
  contentType: string;
}): UploadCheck {
  if (!file.name.trim()) return { ok: false, error: "A file name is required." };
  if (file.sizeBytes <= 0) return { ok: false, error: "The file is empty." };
  if (file.sizeBytes > MAX_DOCUMENT_BYTES) {
    return {
      ok: false,
      error: `File exceeds the ${formatBytes(MAX_DOCUMENT_BYTES)} limit.`,
    };
  }
  if (!ALLOWED_CONTENT_TYPES.has(file.contentType)) {
    return { ok: false, error: "Unsupported file type." };
  }
  return { ok: true };
}

export interface ExtractedFinancials {
  revenue: string | null;
  ebitda: string | null;
  margin: string | null;
  multiple: string | null;
  evidence: string[]; // the snippets the figures came from
}

// Money figure: number + scale word. "$420 million" / "420mm" / "1.2bn".
const MONEY = "\\$?\\s?([\\d][\\d,]*(?:\\.\\d+)?)\\s?(billion|bn|million|mm|m|b)\\b";

function money(num: string, unit: string): string {
  const n = num.replace(/,/g, "");
  const scale = /^b/i.test(unit) ? "B" : "M";
  return `$${n}${scale}`;
}

// First capturing match of any pattern, plus the matched snippet for evidence.
function firstMatch(
  text: string,
  patterns: RegExp[]
): { groups: string[]; snippet: string } | null {
  for (const re of patterns) {
    const m = re.exec(text);
    if (m) return { groups: m.slice(1), snippet: m[0].trim().replace(/\s+/g, " ") };
  }
  return null;
}

export function extractFinancials(text: string): ExtractedFinancials {
  const t = text ?? "";
  const evidence: string[] = [];

  const revenue = firstMatch(t, [
    new RegExp(`(?:revenue|net sales|sales of|turnover)[^.\\n]{0,40}?${MONEY}`, "i"),
    new RegExp(
      `${MONEY}[^.\\n]{0,25}?(?:in revenue|revenue|net sales|sales|turnover)`,
      "i"
    ),
  ]);
  const ebitda = firstMatch(t, [
    new RegExp(`ebitda[^.\\n]{0,40}?${MONEY}`, "i"),
    new RegExp(`${MONEY}[^.\\n]{0,25}?(?:of\\s)?ebitda`, "i"),
  ]);
  const margin = firstMatch(t, [
    /([\d.]+)\s?%[^.\n]{0,25}?(?:ebitda\s)?margin/i,
    /margin[^.\n]{0,25}?(?:of\s)?([\d.]+)\s?%/i,
  ]);
  const multiple = firstMatch(t, [
    /([\d.]+)\s?x\b[^.\n]{0,25}?(?:ebitda|multiple|forward)/i,
    /(?:multiple|valued at|priced at|ebitda)[^.\n]{0,25}?([\d.]+)\s?x\b/i,
  ]);

  if (revenue) evidence.push(revenue.snippet);
  if (ebitda) evidence.push(ebitda.snippet);
  if (margin) evidence.push(margin.snippet);
  if (multiple) evidence.push(multiple.snippet);

  return {
    revenue: revenue ? money(revenue.groups[0]!, revenue.groups[1]!) : null,
    ebitda: ebitda ? money(ebitda.groups[0]!, ebitda.groups[1]!) : null,
    margin: margin ? `${margin.groups[0]}%` : null,
    multiple: multiple ? `${multiple.groups[0]}x` : null,
    evidence: [...new Set(evidence)],
  };
}

export function hasAnyFinancials(f: ExtractedFinancials): boolean {
  return !!(f.revenue || f.ebitda || f.margin || f.multiple);
}

// Frontend-facing document shape (the API/adapters map DB rows onto this).
export interface DealDocument {
  id: string;
  companyId: string;
  name: string;
  kind: DocumentKind;
  storagePath: string | null;
  contentType: string | null;
  sizeBytes: number | null;
  extracted: ExtractedFinancials | null;
  createdAt: string;
}
