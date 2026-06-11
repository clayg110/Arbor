"use client";

import { useState } from "react";
import { buildSignalTimeline } from "@/lib/signal-timeline";
import type { Signal, SourceType } from "@/lib/types";

const SOURCE_COLOR: Record<SourceType, string> = {
  sec_filing: "#185FA5",
  earnings_transcript: "#8A5712",
  google_news: "#157A5A",
  rss_feed: "#9A9890",
  manual: "#5f5e57",
  hsr_filing: "#C0322F",
};

const SOURCE_LABEL: Record<SourceType, string> = {
  sec_filing: "SEC filing",
  earnings_transcript: "Earnings call",
  google_news: "News",
  rss_feed: "RSS feed",
  manual: "Manual",
  hsr_filing: "HSR filing",
};

function dotSize(count: number): number {
  if (count >= 3) return 12;
  if (count === 2) return 10;
  return 8;
}

export function SignalTimeline({
  signals,
  today = new Date().toISOString().slice(0, 10),
  months = 12,
}: {
  signals: Signal[];
  today?: string;
  months?: number;
}) {
  const [hovered, setHovered] = useState<string | null>(null);

  const { dots, ticks } = buildSignalTimeline(signals, today, months);

  if (dots.length === 0) return null;

  return (
    <div className="mb-4">
      {/* timeline track */}
      <div className="relative" style={{ height: 40 }}>
        {/* baseline */}
        <div
          className="absolute left-0 right-0 bg-[var(--border)]"
          style={{ top: 18, height: 1 }}
        />

        {/* month ticks */}
        {ticks.map((t) => (
          <div
            key={t.label + t.x}
            className="absolute"
            style={{ left: `${t.x}%`, top: 13, transform: "translateX(-50%)" }}
          >
            <div className="h-2.5 w-px bg-[var(--border)]" />
          </div>
        ))}

        {/* today marker */}
        <div
          className="absolute"
          style={{
            left: "100%",
            top: 4,
            bottom: 0,
            width: 1,
            background:
              "repeating-linear-gradient(to bottom, #9A9890 0, #9A9890 3px, transparent 3px, transparent 6px)",
          }}
        />

        {/* signal dots */}
        {dots.map((dot) => {
          const sz = dotSize(dot.signals.length);
          const color = SOURCE_COLOR[dot.primarySource];
          const isHovered = hovered === dot.key;
          return (
            <div
              key={dot.key}
              className="absolute cursor-pointer transition-transform"
              style={{
                left: `${dot.x}%`,
                top: 18 - sz / 2,
                transform: `translateX(-50%) scale(${isHovered ? 1.4 : 1})`,
                zIndex: isHovered ? 10 : 1,
              }}
              onMouseEnter={() => setHovered(dot.key)}
              onMouseLeave={() => setHovered(null)}
            >
              <div
                style={{
                  width: sz,
                  height: sz,
                  borderRadius: "50%",
                  background: color,
                  opacity: isHovered ? 1 : 0.8,
                  outline: isHovered ? `2px solid ${color}` : "none",
                  outlineOffset: 2,
                }}
              />
              {/* tooltip */}
              {isHovered && (
                <div
                  className="absolute bottom-full mb-2 w-56 rounded-md border border-[var(--border)] bg-white px-2.5 py-2 shadow-md"
                  style={{
                    left: "50%",
                    transform: "translateX(-50%)",
                    zIndex: 20,
                  }}
                >
                  <p className="mb-1 text-[10px] font-medium" style={{ color }}>
                    {SOURCE_LABEL[dot.primarySource]}
                    {dot.signals.length > 1 && ` · ${dot.signals.length} signals`}
                  </p>
                  <p className="text-[11px] font-medium text-ink">
                    {dot.signals[0].title}
                  </p>
                  {dot.signals[0].excerpt && (
                    <p className="mt-0.5 line-clamp-2 text-[10px] text-subtle">
                      {dot.signals[0].excerpt}
                    </p>
                  )}
                  <p className="mt-1 text-[10px] text-muted">{dot.date}</p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* month labels */}
      <div className="relative" style={{ height: 16 }}>
        {ticks.map((t) => (
          <span
            key={t.label + t.x + "label"}
            className="absolute text-[10px] text-muted"
            style={{ left: `${t.x}%`, transform: "translateX(-50%)" }}
          >
            {t.label}
          </span>
        ))}
      </div>
    </div>
  );
}
