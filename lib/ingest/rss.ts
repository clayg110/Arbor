// PE / M&A RSS scraping (PE Wire, Reuters-style feeds). No key required.
// Override the feed list with INGEST_RSS_FEEDS (comma-separated).

export interface RssItem {
  rawText: string;
  sourceUrl: string;
  sourceName: string;
  docType: string;
}

const DEFAULT_FEEDS = [
  "https://www.privateequitywire.co.uk/feed/",
  "https://pe-insights.com/feed/",
];

export function rssFeeds(): string[] {
  const env = process.env.INGEST_RSS_FEEDS;
  return env ? env.split(",").map((s) => s.trim()).filter(Boolean) : DEFAULT_FEEDS;
}

function clean(s: string): string {
  return s
    .replace(/<!\[CDATA\[/g, "")
    .replace(/\]\]>/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/&#\d+;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function first(block: string, re: RegExp): string {
  const m = block.match(re);
  return m ? clean(m[1]) : "";
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "RSS";
  }
}

export async function fetchRssSignals(limitPerFeed = 10): Promise<RssItem[]> {
  const out: RssItem[] = [];

  for (const feed of rssFeeds()) {
    try {
      const res = await fetch(feed, { headers: { "User-Agent": "Arbor Research" } });
      if (!res.ok) continue;
      const xml = await res.text();
      const items = xml.split(/<item[ >]/i).slice(1, 1 + limitPerFeed);
      for (const it of items) {
        const title = first(it, /<title>([\s\S]*?)<\/title>/i);
        const desc = first(it, /<description>([\s\S]*?)<\/description>/i);
        const link = first(it, /<link>([\s\S]*?)<\/link>/i);
        if (!title) continue;
        out.push({
          rawText: `${title}. ${desc}`.slice(0, 4000),
          sourceUrl: link || feed,
          sourceName: hostOf(feed),
          docType: "RSS feed",
        });
      }
    } catch {
      // skip unreachable feed
    }
  }

  return out;
}
