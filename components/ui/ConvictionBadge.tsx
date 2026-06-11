import {
  CONVICTION_COLOR,
  CONVICTION_LABEL,
  type ConvictionBand,
} from "@/lib/conviction";

// Compact conviction indicator: a band-colored dot + the 0–100 score. The score
// renders in ink (always AA); the dot is decorative so band color never carries
// text contrast. Used on radar cards + the radar table.
export function ConvictionBadge({
  score,
  band,
  showLabel = false,
}: {
  score: number;
  band: ConvictionBand;
  showLabel?: boolean;
}) {
  return (
    <span
      className="inline-flex items-center gap-1 text-[11px] font-medium text-ink"
      title={`Conviction: ${CONVICTION_LABEL[band]} (${score}/100)`}
    >
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: CONVICTION_COLOR[band] }}
        aria-hidden
      />
      {score}
      {showLabel && <span className="text-muted">{CONVICTION_LABEL[band]}</span>}
    </span>
  );
}
