"use client";

import { useState } from "react";
import Link from "next/link";
import { DealTypeBadge } from "./DealTypeBadge";
import { SectorBadge } from "./SectorBadge";
import { ConfidenceBadge } from "./ConfidenceBadge";
import { ConvictionBadge } from "./ConvictionBadge";
import { MarketTimingBadge } from "./MarketTimingBadge";
import { SignalSourceBadge } from "./SignalSourceBadge";
import { Tooltip } from "./Tooltip";
import { StarIcon, ChevronRightIcon, GripIcon, ClockIcon } from "./icons";
import { STAGE_COLORS, STAGE_LABELS, CONFIDENCE_LABELS } from "@/lib/colors";
import { daysLabel } from "@/lib/format";
import type { RadarCompany } from "@/lib/radar-data";
import type { Stage } from "@/lib/types";

const PULLED_ACCENT = "#6f6e68";
const ALL_STAGES: Stage[] = ["in_market", "monitor_for_exit", "on_hold", "pulled"];

export function RadarCompanyCard({
  c,
  watched,
  onToggleWatch,
  draggable = false,
  dragging = false,
  onCardDragStart,
  onCardDragEnd,
  onMoveStage,
}: {
  c: RadarCompany;
  watched: boolean;
  onToggleWatch: () => void;
  draggable?: boolean;
  dragging?: boolean;
  onCardDragStart?: (e: React.DragEvent) => void;
  onCardDragEnd?: () => void;
  // Keyboard-accessible equivalent of dragging the card to another column.
  onMoveStage?: (target: Stage) => void;
}) {
  const [hover, setHover] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const ownerLabel = c.dealType === "carveout" ? "Parent" : "Sponsor";
  const accent = c.pulled ? PULLED_ACCENT : (STAGE_COLORS[c.stage].border ?? "#888");
  const isCol3 = c.stage === "on_hold" || c.stage === "pulled";
  // "Coming to market" is only a meaningful question before an asset is already
  // in market (and a pulled process is dormant) — show it for monitor/on-hold.
  const showTiming =
    !!c.marketTiming && (c.stage === "monitor_for_exit" || c.stage === "on_hold");
  const stale = c.lastSignal.daysAgo > 30;
  const urgent = c.stage === "in_market" && c.days > 60;
  const confTip = `Confidence: ${CONFIDENCE_LABELS[c.confidence].replace(
    " confidence",
    ""
  )} — based on ${c.lastSignal.sourceName} (primary source). Last verified: ${c.lastSignal.label}.`;

  const body = (
    <>
      {/* drag handle — card is draggable between kanban columns to change stage */}
      <span
        className="absolute left-0.5 top-1/2 -translate-y-1/2 transition-opacity"
        style={{ opacity: hover ? 0.4 : 0 }}
        aria-hidden
      >
        <GripIcon className="h-4 w-4 text-subtle" />
      </span>

      {/* top row: deal type + conviction + star */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <DealTypeBadge type={c.dealType} />
          {c.conviction && (
            <ConvictionBadge score={c.conviction.score} band={c.conviction.band} />
          )}
        </div>
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onToggleWatch();
          }}
          aria-label={watched ? "Unwatch" : "Watch"}
          className="-mr-0.5 -mt-0.5 text-muted hover:text-ink"
        >
          <StarIcon
            filled={watched}
            className="h-4 w-4"
            style={{ color: watched ? "#BA7517" : undefined }}
          />
        </button>
      </div>

      {/* name (left) + logo (right) */}
      <div className="mt-2 flex items-start justify-between gap-2">
        <h3
          className="text-[14px] font-medium leading-snug text-ink"
          style={c.pulled ? { textDecoration: "line-through" } : undefined}
        >
          {c.name}
        </h3>
        <LogoBox name={c.name} url={c.logoUrl} />
      </div>

      {/* sector + subsector + confidence */}
      <div className="mt-2 flex flex-wrap items-center gap-1">
        <SectorBadge sector={c.sector} />
        {c.subsector && (
          <span className="rounded-full bg-[#F1EFE8] px-2 py-0.5 text-[10px] font-medium text-[#444441]">
            {c.subsector}
          </span>
        )}
        <Tooltip text={confTip} width={230}>
          {c.pulled ? (
            <span className="inline-flex items-center rounded-full bg-[#EDEBE4] px-2 py-0.5 text-[11px] font-medium text-[#555550]">
              Pulled
            </span>
          ) : (
            <ConfidenceBadge confidence={c.confidence} />
          )}
        </Tooltip>
      </div>

      {/* owner */}
      <p className="mt-2 text-[11px] font-normal text-muted">
        {ownerLabel}: {c.ownerName}
      </p>

      {/* financials (shown when known) */}
      {(c.revenue || c.ebitda || c.margin) && (
        <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5">
          {c.revenue && <CardStat label="Rev" value={c.revenue} />}
          {c.ebitda && <CardStat label="EBITDA" value={c.ebitda} />}
          {c.margin && <CardStat label="Margin" value={c.margin} />}
        </div>
      )}

      {/* description */}
      {c.description && (
        <p className="mt-1.5 line-clamp-2 text-[11px] font-normal text-subtle">
          {c.description}
        </p>
      )}

      <div className="my-2 h-px" style={{ backgroundColor: "var(--border)" }} />

      {/* days / stage note */}
      <p className="text-[11px] font-normal text-subtle">
        {isCol3 ? c.stageNote : `${daysLabel(c.days)} · Added ${c.addedDisplay}`}
      </p>
      {urgent && (
        <Tooltip text="Unusually long in market — process may be stalling." width={210}>
          <span
            className="mt-1 inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium"
            style={{ backgroundColor: "#FAEEDA", color: "#633806" }}
          >
            ⚠ 60d+
          </span>
        </Tooltip>
      )}

      {/* coming-to-market prediction (monitor / on-hold only) */}
      {showTiming && c.marketTiming && (
        <div className="mt-1.5">
          <MarketTimingBadge timing={c.marketTiming} />
        </div>
      )}

      {/* last signal */}
      <div className="mt-1.5 flex items-center gap-1.5 text-[11px] font-normal text-muted">
        <SignalSourceBadge source={c.lastSignal.source} />
        <span>
          Last signal: {c.lastSignal.label} ({c.lastSignal.sourceName})
        </span>
        {stale && (
          <Tooltip
            text="No recent signals — stage may be outdated. Consider manual review."
            width={220}
          >
            <ClockIcon className="h-3.5 w-3.5" style={{ color: "#BA7517" }} />
          </Tooltip>
        )}
      </div>

      {/* keyboard-accessible stage move (parity with drag-and-drop) */}
      {onMoveStage && (
        <div
          className="relative mt-2"
          onKeyDown={(e) => {
            if (e.key === "Escape" && moveOpen) {
              e.preventDefault();
              setMoveOpen(false);
            }
          }}
        >
          <button
            type="button"
            aria-haspopup="menu"
            aria-expanded={moveOpen}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setMoveOpen((o) => !o);
            }}
            className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium text-muted hover:text-ink"
            style={{ border: "0.5px solid var(--border)" }}
          >
            Move stage ▾
          </button>
          {moveOpen && (
            <div
              role="menu"
              aria-label="Move to stage"
              className="absolute left-0 z-10 mt-1 w-40 overflow-hidden rounded-md bg-surface py-1"
              style={{
                border: "0.5px solid var(--border)",
                boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
              }}
            >
              {ALL_STAGES.filter((s) => s !== c.stage).map((s) => (
                <button
                  key={s}
                  type="button"
                  role="menuitem"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setMoveOpen(false);
                    onMoveStage(s);
                  }}
                  className="block w-full px-3 py-1.5 text-left text-[12px] text-ink hover:bg-[#F5F4EF]"
                >
                  {STAGE_LABELS[s]}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* expanded (watchlisted) */}
      {watched && (
        <div className="mt-3">
          <StageProgress stage={c.stage} accent={accent} />
          {c.quote && (
            <blockquote
              className="mt-2 line-clamp-2 rounded-r px-2 py-1.5 text-[11px] font-normal italic text-muted"
              style={{ backgroundColor: "#F5F4EF", borderLeft: `2px solid ${accent}` }}
            >
              “{c.quote}”
            </blockquote>
          )}
          {c.companyId && (
            <div className="mt-1.5 text-right">
              <span className="text-[11px] font-normal text-[#185FA5]">
                View profile →
              </span>
            </div>
          )}
        </div>
      )}

      {/* hover chevron */}
      {hover && (
        <span className="absolute bottom-2 right-2" aria-hidden>
          <ChevronRightIcon className="h-4 w-4" style={{ color: accent }} />
        </span>
      )}
    </>
  );

  const className = "relative block rounded-lg p-3 pl-4 transition-colors";
  const style: React.CSSProperties = {
    border: `0.5px solid ${hover ? accent : "var(--border)"}`,
    backgroundColor: hover ? `${accent}0D` : "var(--surface)",
    // Pulled cards are signalled by the line-through name + "Pulled" badge +
    // muted accent — not a card-wide opacity dim, which would drop text below
    // the WCAG AA contrast floor. Dragging still dims (transient, non-text-critical).
    opacity: dragging ? 0.4 : 1,
    cursor: draggable ? "grab" : undefined,
  };

  const handlers = {
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => setHover(false),
  };

  const dragProps = draggable
    ? { draggable: true, onDragStart: onCardDragStart, onDragEnd: onCardDragEnd }
    : {};

  return c.companyId ? (
    <Link
      href={`/company/${c.companyId}`}
      className={className}
      style={style}
      {...handlers}
      {...dragProps}
    >
      {body}
    </Link>
  ) : (
    <div className={className} style={style} {...handlers} {...dragProps}>
      {body}
    </div>
  );
}

// company logo — image when known, initials placeholder otherwise
function LogoBox({ name, url }: { name: string; url?: string | null }) {
  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt=""
        className="h-7 w-7 shrink-0 rounded object-contain"
        style={{ border: "0.5px solid var(--border)" }}
      />
    );
  }
  const initials =
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0])
      .join("")
      .toUpperCase() || "—";
  return (
    <span
      className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-[#F1EFE8] text-[10px] font-medium text-[#444441]"
      style={{ border: "0.5px solid var(--border)" }}
      aria-hidden
    >
      {initials}
    </span>
  );
}

function CardStat({ label, value }: { label: string; value: string }) {
  return (
    <span className="text-[11px] font-normal">
      <span className="text-subtle">{label} </span>
      <span className="font-medium text-ink">{value}</span>
    </span>
  );
}

// mini journey: Monitor → In market → Exit
function StageProgress({
  stage,
  accent,
}: {
  stage: RadarCompany["stage"];
  accent: string;
}) {
  const steps = ["Monitor", "In market", "Exit"];
  const current = stage === "monitor_for_exit" ? 0 : stage === "in_market" ? 1 : 2;
  // The bar uses the (possibly light) accent; the label uses the stage's dark
  // swatch text color so the 8px text clears WCAG AA. Inactive labels track the
  // AA-compliant --text-subtle token.
  const currentText = STAGE_COLORS[stage].text;
  return (
    <div className="flex items-center gap-1">
      {steps.map((s, i) => (
        <div key={s} className="flex flex-1 flex-col items-center gap-0.5">
          <div
            className="h-1 w-full rounded-full"
            style={{ backgroundColor: i === current ? accent : "#E6E4DD" }}
          />
          <span
            className="text-[8px] font-normal"
            style={{ color: i === current ? currentText : "var(--text-subtle)" }}
          >
            {s}
          </span>
        </div>
      ))}
    </div>
  );
}
