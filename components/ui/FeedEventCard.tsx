"use client";

import Link from "next/link";
import { DealTypeBadge } from "./DealTypeBadge";
import { SectorBadge } from "./SectorBadge";
import { StageBadge } from "./StageBadge";
import { ConfidenceBadge } from "./ConfidenceBadge";
import { Pill } from "./Pill";
import {
  ArrowsExchangeIcon,
  EyeIcon,
  PauseIcon,
  XIcon,
  BuildingIcon,
  AlertTriangleIcon,
  ShieldIcon,
  StarIcon,
  DocumentIcon,
  MicIcon,
  GlobeIcon,
  RssIcon,
  PencilIcon,
} from "./icons";
import { STAGE_COLORS, STAGE_LABELS } from "@/lib/colors";
import type { FeedItemType } from "@/lib/feed-data";
import type { FeedItemData } from "@/lib/adapters/feed";
import type { SourceType } from "@/lib/types";

const TYPE_VISUAL: Record<FeedItemType, { color: string; Icon: typeof XIcon }> = {
  to_in_market: { color: "#185FA5", Icon: ArrowsExchangeIcon },
  to_monitor: { color: "#BA7517", Icon: EyeIcon },
  to_on_hold: { color: "#E24B4A", Icon: PauseIcon },
  pulled: { color: "#791F1F", Icon: XIcon },
  new_entry: { color: "#27500A", Icon: BuildingIcon },
  flagged: { color: "#BA7517", Icon: AlertTriangleIcon },
  confidence_update: { color: "#9A9890", Icon: ShieldIcon },
};

const SOURCE_ICON: Record<SourceType, typeof DocumentIcon> = {
  sec_filing: DocumentIcon,
  earnings_transcript: MicIcon,
  google_news: GlobeIcon,
  rss_feed: RssIcon,
  manual: PencilIcon,
};

export function FeedEventCard({
  item,
  isWatched,
  onToggleWatch,
}: {
  item: FeedItemData;
  isWatched: boolean;
  onToggleWatch: () => void;
}) {
  const visual = TYPE_VISUAL[item.type];
  const SourceIcon = SOURCE_ICON[item.source.sourceType];

  return (
    <div
      className="flex gap-3 py-3.5"
      style={{ borderBottom: "0.5px solid var(--border)" }}
    >
      {/* ZONE 1 — icon */}
      <div
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
        style={{ backgroundColor: visual.color }}
        aria-hidden
      >
        <visual.Icon className="h-[18px] w-[18px] text-white" />
      </div>

      <div className="min-w-0 flex-1">
        {/* ZONE 2 — headline */}
        <div className="flex items-start justify-between gap-3">
          <p className="text-[13px] leading-snug">
            {item.companyId ? (
              <Link
                href={`/company/${item.companyId}`}
                className="font-medium text-ink hover:underline"
              >
                {item.company}
              </Link>
            ) : (
              <span className="font-medium text-ink">{item.company}</span>
            )}{" "}
            <span className="font-normal text-muted">{item.headline}</span>
          </p>
          <div className="flex shrink-0 items-center gap-2">
            <span className="text-[11px] font-normal text-subtle">{item.timeLabel}</span>
            <button
              type="button"
              onClick={onToggleWatch}
              aria-pressed={isWatched}
              aria-label={isWatched ? "Remove from watchlist" : "Add to watchlist"}
              className="text-muted hover:text-ink"
            >
              <StarIcon
                filled={isWatched}
                className="h-4 w-4"
                style={{ color: isWatched ? "#BA7517" : undefined }}
              />
            </button>
          </div>
        </div>

        {/* ZONE 3 — badges */}
        <div className="mt-1.5 flex flex-wrap items-center gap-1">
          <DealTypeBadge type={item.dealType} />
          <SectorBadge sector={item.sector} />
          <StageBadge stage={item.stage} />
          <ConfidenceBadge confidence={item.confidence} />
          {isWatched && (
            <Pill bg="#E6F1FB" text="#0C447C" border="#185FA5">
              Watchlist
            </Pill>
          )}
        </div>

        {/* ZONE 4 — source attribution */}
        <div className="mt-2 flex items-center gap-1.5 text-[11px] font-normal text-muted">
          <SourceIcon className="h-3.5 w-3.5 text-subtle" />
          <span>{item.source.name}</span>
          <span className="text-subtle">·</span>
          <span>{item.source.docType}</span>
          <span className="text-subtle">·</span>
          <a
            href={item.sourceUrl}
            target="_blank"
            rel="noreferrer"
            className="text-[#185FA5] hover:underline"
          >
            View source
          </a>
        </div>

        {/* ZONE 5 — expanded content */}
        {item.expanded && (
          <div className="mt-2.5">
            {item.expanded.kind === "quote" && (
              <Quote
                text={item.expanded.text}
                attribution={item.expanded.attribution}
                stage={item.stage}
              />
            )}
            {item.expanded.kind === "note" && (
              <div
                className="rounded-r px-3 py-2 text-[12px] font-normal text-muted"
                style={{
                  backgroundColor: "#F5F4EF",
                  borderLeft: "2px solid var(--border)",
                }}
              >
                {item.expanded.text}
              </div>
            )}
            {item.expanded.kind === "new_entry" && <NewEntry content={item.expanded} />}
            {item.expanded.kind === "conflict" && (
              <Conflict signalA={item.expanded.signalA} signalB={item.expanded.signalB} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Quote({
  text,
  attribution,
  stage,
}: {
  text: string;
  attribution: string;
  stage: FeedItemData["stage"];
}) {
  const c = STAGE_COLORS[stage];
  return (
    <figure
      className="rounded-r px-3 py-2"
      style={{ backgroundColor: c.bg, borderLeft: `2px solid ${c.border ?? c.text}` }}
    >
      <blockquote className="text-[12px] font-normal italic" style={{ color: c.text }}>
        “{text}”
      </blockquote>
      <figcaption className="mt-1 text-[11px] font-normal text-muted">
        — {attribution}
      </figcaption>
    </figure>
  );
}

function NewEntry({
  content,
}: {
  content: Extract<NonNullable<FeedItemData["expanded"]>, { kind: "new_entry" }>;
}) {
  return (
    <div
      className="rounded-lg p-3"
      style={{ backgroundColor: "#F5F4EF", border: "0.5px solid var(--border)" }}
    >
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] font-normal text-muted">
        <span>
          <span className="text-subtle">{content.ownerLabel}: </span>
          <span className="font-medium text-ink">{content.ownerName}</span>
        </span>
        <span className="text-subtle">·</span>
        <span>{content.sectorLabel}</span>
        <span className="text-subtle">·</span>
        <span>
          <span className="text-subtle">Est. deal size: </span>
          <span className="font-medium text-ink">{content.dealSize}</span>
        </span>
      </div>
      <p className="mt-2 text-[12px] font-normal text-muted">{content.reason}</p>
    </div>
  );
}

function Conflict({
  signalA,
  signalB,
}: {
  signalA: { source: string; text: string; stage: FeedItemData["stage"] };
  signalB: { source: string; text: string; stage: FeedItemData["stage"] };
}) {
  return (
    <div
      className="rounded-lg p-3"
      style={{ backgroundColor: "#FCEBEB", border: "0.5px solid #E24B4A33" }}
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <SignalCol label="Signal A says" signal={signalA} />
        <SignalCol label="Signal B says" signal={signalB} />
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <span className="text-[11px] font-medium" style={{ color: "#791F1F" }}>
          Confidence: low — analyst review required
        </span>
        <Link
          href="/review"
          className="rounded-md px-2.5 py-1 text-[11px] font-medium text-white"
          style={{ backgroundColor: "#C0322F" }}
        >
          Review now
        </Link>
      </div>
    </div>
  );
}

function SignalCol({
  label,
  signal,
}: {
  label: string;
  signal: { source: string; text: string; stage: FeedItemData["stage"] };
}) {
  const c = STAGE_COLORS[signal.stage];
  return (
    <div
      className="rounded-md bg-surface p-2.5"
      style={{ border: "0.5px solid var(--border)" }}
    >
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="text-[11px] font-medium text-ink">{label}</span>
        <span
          className="rounded-full px-1.5 py-0.5 text-[10px] font-medium"
          style={{ backgroundColor: c.bg, color: c.text }}
        >
          {STAGE_LABELS[signal.stage]}
        </span>
      </div>
      <p className="text-[12px] font-normal italic text-muted">“{signal.text}”</p>
      <p className="mt-1 text-[11px] font-normal text-subtle">{signal.source}</p>
    </div>
  );
}
