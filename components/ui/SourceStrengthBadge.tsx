import {
  CREDIBILITY_TIER_COLOR,
  CREDIBILITY_TIER_LABEL,
  type SourceStrength,
} from "@/lib/source-credibility";
import type { SourceType } from "@/lib/types";

const SOURCE_LABEL: Record<SourceType, string> = {
  sec_filing: "SEC filing",
  hsr_filing: "HSR filing",
  earnings_transcript: "Earnings call",
  google_news: "News",
  rss_feed: "RSS feed",
  manual: "Manual",
};

// Credibility-weighted source-strength indicator: a tier-colored dot + label.
// The dot is decorative (AA contrast carried by the ink label); the tooltip
// names the strongest source and distinct-source count behind the score.
export function SourceStrengthBadge({ strength }: { strength: SourceStrength }) {
  if (strength.distinctSources === 0) return null;
  const top = strength.topSource ? SOURCE_LABEL[strength.topSource] : null;
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full bg-[#F1EFE8] px-2 py-0.5 text-[11px] font-medium text-ink"
      title={`Source strength: ${strength.score}/100 — ${strength.distinctSources} distinct source${
        strength.distinctSources === 1 ? "" : "s"
      }${top ? `, strongest: ${top}` : ""}`}
    >
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: CREDIBILITY_TIER_COLOR[strength.tier] }}
        aria-hidden
      />
      {CREDIBILITY_TIER_LABEL[strength.tier]}
    </span>
  );
}
