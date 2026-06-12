import type { MomentumResult } from "@/lib/signal-momentum";

const TREND_META: Record<
  string,
  { bg: string; text: string; border: string; icon: string }
> = {
  accelerating: {
    bg: "#F0FBF6",
    text: "#157A5A",
    border: "#A8E8CF",
    icon: "↑",
  },
  cooling: {
    bg: "#FEF4F4",
    text: "#C0322F",
    border: "#F5BEBE",
    icon: "↓",
  },
  stable: {
    bg: "var(--surface)",
    text: "var(--text-muted)",
    border: "var(--border)",
    icon: "→",
  },
};

interface Props {
  momentum: MomentumResult;
  // Show a mini sparkline alongside the badge.
  showSparkline?: boolean;
}

// A compact badge + optional inline sparkline for the signal momentum trend.
export function MomentumBadge({ momentum, showSparkline = false }: Props) {
  const meta = TREND_META[momentum.trend] ?? TREND_META.stable!;

  return (
    <div className="inline-flex items-center gap-2">
      <span
        className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium"
        style={{
          background: meta.bg,
          color: meta.text,
          border: `0.5px solid ${meta.border}`,
        }}
      >
        <span aria-hidden>{meta.icon}</span>
        {momentum.label}
      </span>
      {showSparkline && <Sparkline data={momentum.sparkline} trend={momentum.trend} />}
    </div>
  );
}

function Sparkline({ data, trend }: { data: number[]; trend: string }) {
  const max = Math.max(...data, 1);
  const w = 40;
  const h = 16;
  const step = w / (data.length - 1);

  const points = data.map((v, i) => `${i * step},${h - (v / max) * h}`).join(" ");

  const color = TREND_META[trend]?.text ?? "#9a968e";

  return (
    <svg
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      aria-hidden
      style={{ display: "block", flexShrink: 0 }}
    >
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}
