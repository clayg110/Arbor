import {
  MARKET_TIMING_COLOR,
  MARKET_TIMING_LABEL,
  type MarketTiming,
} from "@/lib/predict-market";

// Compact "coming-to-market" indicator: a band-colored dot + horizon label.
// The label renders in ink (always AA); the dot is decorative so band color
// never carries text contrast. The tooltip surfaces the top drivers + score.
// Shown for monitor/on-hold deals — the question "is this coming to market?"
// is only meaningful before an asset is already in market.
export function MarketTimingBadge({ timing }: { timing: MarketTiming }) {
  const driverText = timing.drivers.length > 0 ? ` — ${timing.drivers.join("; ")}` : "";
  return (
    <span
      className="inline-flex items-center gap-1 text-[11px] font-medium text-ink"
      title={`Coming to market: ${MARKET_TIMING_LABEL[timing.band]} (${timing.score}/100, ${timing.horizon})${driverText}`}
    >
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: MARKET_TIMING_COLOR[timing.band] }}
        aria-hidden
      />
      <span className="text-muted">Mkt</span>
      {timing.horizon}
    </span>
  );
}
