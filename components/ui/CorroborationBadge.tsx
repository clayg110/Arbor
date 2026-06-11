import type { CorroborationResult } from "@/lib/corroboration";

const SOURCE_LABELS: Record<string, string> = {
  sec_filing: "SEC",
  earnings_transcript: "Earnings",
  google_news: "News",
  rss_feed: "RSS",
  manual: "Manual",
};

interface Props {
  corroboration: CorroborationResult;
}

// Shows a "Multi-source" trust badge when ≥ 3 independent sources agree.
// Renders nothing when not corroborated so the caller can conditionally mount.
export function CorroborationBadge({ corroboration }: Props) {
  if (!corroboration.corroborated) return null;

  const sourceList = corroboration.sources.map((s) => SOURCE_LABELS[s] ?? s).join(", ");

  return (
    <span
      title={`Corroborated by ${corroboration.sourceCount} sources: ${sourceList}`}
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium"
      style={{
        background: "#F0FBF6",
        color: "#157A5A",
        border: "0.5px solid #A8E8CF",
      }}
    >
      <span aria-hidden>✓</span>
      Multi-source ({corroboration.sourceCount})
    </span>
  );
}
