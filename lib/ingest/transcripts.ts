// Earnings-call transcript ingestion via Financial Modeling Prep (FMP).
// Carveouts/divestitures are frequently first disclosed on a parent company's
// earnings call ("we are exploring strategic alternatives for our X unit").
// Gated on FMP_API_KEY + TRANSCRIPT_TICKERS (comma-separated parent tickers).
// No-op unless both are set. Override the host with FMP_BASE_URL.

export interface TranscriptItem {
  rawText: string;
  sourceUrl: string;
  sourceName: string;
  docType: string;
}

const BASE = process.env.FMP_BASE_URL ?? "https://financialmodelingprep.com";

export function transcriptTickers(): string[] {
  const env = process.env.TRANSCRIPT_TICKERS;
  return env
    ? env
        .split(",")
        .map((s) => s.trim().toUpperCase())
        .filter(Boolean)
    : [];
}

export function hasTranscriptEnv(): boolean {
  return !!process.env.FMP_API_KEY && transcriptTickers().length > 0;
}

interface FmpTranscript {
  symbol?: string;
  quarter?: number;
  year?: number;
  date?: string;
  content?: string;
}

// Latest available transcript per ticker. Returns one signal per ticker that
// has transcript content; skips unreachable / rate-limited symbols.
export async function fetchTranscriptSignals(maxTickers = 10): Promise<TranscriptItem[]> {
  const key = process.env.FMP_API_KEY;
  if (!key) return [];

  const tickers = transcriptTickers().slice(0, maxTickers);
  const out: TranscriptItem[] = [];

  for (const symbol of tickers) {
    try {
      const url = `${BASE}/api/v3/earning_call_transcript/${encodeURIComponent(symbol)}?apikey=${key}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
      if (!res.ok) continue;
      const data = (await res.json()) as FmpTranscript[];
      const t = Array.isArray(data) ? data.find((d) => d.content) : null;
      if (!t?.content) continue;

      const label = [symbol, t.quarter ? `Q${t.quarter}` : null, t.year]
        .filter(Boolean)
        .join(" ");
      out.push({
        rawText: t.content.slice(0, 8000),
        sourceUrl: `${BASE}/earning-call-transcript/${symbol}`,
        sourceName: `${symbol} earnings call`,
        docType: label ? `${label} transcript` : "Earnings transcript",
      });
    } catch {
      // skip unreachable / rate-limited ticker
    }
  }

  return out;
}
