"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { FeedEventCard } from "@/components/ui/FeedEventCard";
import { StageBadge } from "@/components/ui/StageBadge";
import { DateRangeControl } from "@/components/ui/DateRangeControl";
import { useDateRange, type CommittedRange } from "@/components/ui/useDateRange";
import { BellIcon, RefreshIcon, StarIcon, InboxIcon } from "@/components/ui/icons";
import {
  feedItems,
  DAY_LABELS,
  initialWatchlist,
  sectorsActive,
  liveStatus,
  type WatchEntry,
} from "@/lib/feed-data";
import {
  statsFor,
  distributionFor,
  presetToToken,
  PRESET_LABEL,
} from "@/lib/analytics-data";
import { SECTOR_LABELS, STAGE_DOT } from "@/lib/colors";
import { cn, formatDate } from "@/lib/format";
import { useLive } from "@/lib/use-live";
import { api } from "@/lib/api-client";
import type { FeedItemData } from "@/lib/adapters/feed";
import type { DealType, Sector } from "@/lib/types";

type TypeFilter = "all" | "stage_changes" | "new_entries" | "flagged";
type SectorFilter = "all" | Sector;
type DealFilter = "all" | DealType;

const TYPE_FILTERS: { v: TypeFilter; label: string }[] = [
  { v: "all", label: "All events" },
  { v: "stage_changes", label: "Stage changes" },
  { v: "new_entries", label: "New entries" },
  { v: "flagged", label: "Analyst flagged" },
];

const FEED_SECTORS: Sector[] = [
  "chemicals",
  "industrials",
  "agriculture",
  "specialty_materials",
  "energy_fuels",
];

const STAGE_CHANGE_TYPES: FeedItemData["type"][] = [
  "to_in_market",
  "to_monitor",
  "to_on_hold",
  "pulled",
];

// Mock feed items normalized to the live FeedItemData shape (dayLabel-based).
const MOCK_ITEMS: FeedItemData[] = feedItems.map((it) => ({
  id: it.id,
  type: it.type,
  companyId: it.companyId ?? "",
  company: it.company,
  dealType: it.dealType,
  sector: it.sector,
  confidence: it.confidence,
  stage: it.stage,
  headline: it.headline,
  source: it.source,
  sourceUrl: it.sourceUrl,
  timeLabel: it.timeLabel,
  dateKey: "",
  dayLabel: DAY_LABELS[it.day],
  expanded: it.expanded,
}));

// Metadata for any company that can appear in the watchlist (initial + feed).
const WATCH_META: Record<string, WatchEntry> = (() => {
  const map: Record<string, WatchEntry> = {};
  for (const w of initialWatchlist) map[w.name] = w;
  for (const it of feedItems) {
    if (!map[it.company]) {
      map[it.company] = {
        name: it.company,
        companyId: it.companyId,
        stage: it.stage,
        eventToday: it.day === "today",
      };
    }
  }
  return map;
})();

export default function FeedPage() {
  return (
    <Suspense fallback={null}>
      <FeedInner />
    </Suspense>
  );
}

function FeedInner() {
  const params = useSearchParams();
  const qFrom = params.get("from");
  const qTo = params.get("to");
  const sidebarInitial: CommittedRange | undefined =
    qFrom && qTo ? { preset: "custom", from: qFrom, to: qTo } : undefined;

  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [sector, setSector] = useState<SectorFilter>("all");
  const [deal, setDeal] = useState<DealFilter>("all");
  const [watchOnly, setWatchOnly] = useState(false);
  const [highConfOnly, setHighConfOnly] = useState(false);
  const [watch, setWatch] = useState<Set<string>>(
    () => new Set(initialWatchlist.map((w) => w.name))
  );

  const live = useLive(
    "feed",
    () => api.feed("?limit=150"),
    { items: MOCK_ITEMS },
    { realtime: true }
  );
  const items = live.data.items;

  const isWatched = (name: string) => watch.has(name);
  const toggleWatch = (name: string, companyId?: string) => {
    const adding = !watch.has(name);
    setWatch((prev) => {
      const next = new Set(prev);
      if (adding) next.add(name);
      else next.delete(name);
      return next;
    });
    // Persist by id when live; BackendOff (mock) is swallowed so toggle still works.
    if (companyId) {
      (adding ? api.addWatch(companyId) : api.removeWatch(companyId)).catch(() => {});
    }
  };

  const filtered = useMemo(() => {
    return items.filter((it) => {
      if (typeFilter === "stage_changes" && !STAGE_CHANGE_TYPES.includes(it.type))
        return false;
      if (typeFilter === "new_entries" && it.type !== "new_entry") return false;
      if (typeFilter === "flagged" && it.type !== "flagged") return false;
      if (sector !== "all" && it.sector !== sector) return false;
      if (deal !== "all" && it.dealType !== deal) return false;
      if (watchOnly && !watch.has(it.company)) return false;
      if (highConfOnly && (it.confidence === "needs_review" || it.confidence === "low"))
        return false;
      return true;
    });
  }, [items, typeFilter, sector, deal, watchOnly, highConfOnly, watch]);

  // Group consecutive items by day label (preserves order).
  const groups = useMemo(() => {
    const out: { label: string; items: FeedItemData[] }[] = [];
    for (const it of filtered) {
      const last = out[out.length - 1];
      if (last && last.label === it.dayLabel) last.items.push(it);
      else out.push({ label: it.dayLabel, items: [it] });
    }
    return out;
  }, [filtered]);

  function clearAll() {
    setTypeFilter("all");
    setSector("all");
    setDeal("all");
    setWatchOnly(false);
    setHighConfOnly(false);
  }

  const watchEntries = Array.from(watch)
    .map((name) => WATCH_META[name])
    .filter(Boolean);

  return (
    <div>
      {/* header */}
      <div className="mb-4 flex items-center gap-2">
        <BellIcon className="h-[18px] w-[18px] text-muted" />
        <h1 className="text-[18px] font-medium text-ink">Activity feed</h1>
      </div>

      {/* FILTER BAR */}
      <div className="mb-1.5 flex flex-wrap items-center gap-2">
        <div
          className="inline-flex rounded-md bg-surface p-0.5"
          style={{ border: "0.5px solid var(--border)" }}
        >
          {TYPE_FILTERS.map((f) => (
            <button
              key={f.v}
              type="button"
              onClick={() => setTypeFilter(f.v)}
              className={cn(
                "rounded px-3 py-1 text-[12px] font-medium transition-colors",
                typeFilter === f.v ? "text-white" : "text-muted hover:text-ink"
              )}
              style={typeFilter === f.v ? { backgroundColor: "#185FA5" } : undefined}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* chip row */}
      <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
        <Chip active={sector === "all"} onClick={() => setSector("all")}>
          All sectors
        </Chip>
        {FEED_SECTORS.map((s) => (
          <Chip key={s} active={sector === s} onClick={() => setSector(s)}>
            {SECTOR_LABELS[s]}
          </Chip>
        ))}
        <span className="mx-1 h-4 w-px" style={{ backgroundColor: "var(--border)" }} />
        <Chip active={deal === "all"} onClick={() => setDeal("all")}>
          All types
        </Chip>
        <Chip active={deal === "carveout"} onClick={() => setDeal("carveout")}>
          Carveouts
        </Chip>
        <Chip active={deal === "private_asset"} onClick={() => setDeal("private_asset")}>
          Private assets
        </Chip>
        <span className="mx-1 h-4 w-px" style={{ backgroundColor: "var(--border)" }} />
        <Chip active={watchOnly} onClick={() => setWatchOnly((v) => !v)}>
          <span className="inline-flex items-center gap-1">
            <StarIcon filled={watchOnly} className="h-3 w-3" />
            Watchlist only
          </span>
        </Chip>
        <Chip active={highConfOnly} onClick={() => setHighConfOnly((v) => !v)}>
          High confidence only
        </Chip>
      </div>

      <p className="mb-5 text-[12px] font-normal text-subtle">
        Showing {filtered.length} of {items.length} events
      </p>

      {/* MAIN: list + sidebar */}
      <div className="flex flex-col gap-4 lg:flex-row">
        {/* list */}
        <div className="min-w-0 flex-1">
          {groups.length === 0 ? (
            <EmptyState onClear={clearAll} />
          ) : (
            groups.map((g) => (
              <DayGroup key={g.label} label={g.label} items={g.items}>
                {g.items.map((it) => (
                  <FeedEventCard
                    key={it.id}
                    item={it}
                    isWatched={isWatched(it.company)}
                    onToggleWatch={() =>
                      toggleWatch(it.company, it.companyId || undefined)
                    }
                  />
                ))}
              </DayGroup>
            ))
          )}
        </div>

        {/* sidebar — 240px */}
        <aside className="w-full shrink-0 space-y-4 lg:w-[240px]">
          {/* Card 1 — live */}
          <Card>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-[13px] font-medium text-ink">
                <span className="relative flex h-2 w-2">
                  <span
                    className="absolute inline-flex h-full w-full rounded-full animate-ping-dot"
                    style={{ backgroundColor: "#E24B4A" }}
                  />
                  <span
                    className="relative inline-flex h-2 w-2 rounded-full"
                    style={{ backgroundColor: "#E24B4A" }}
                  />
                </span>
                Live
              </span>
              <span className="text-[11px] font-normal text-subtle">
                Updated {liveStatus.updatedAgo}
              </span>
            </div>
            <p className="mt-2 text-[13px] font-medium text-ink">
              {liveStatus.newToday} new events today
            </p>
            <div className="mt-2 h-1.5 w-full rounded-full bg-[#F1EFE8]">
              <div
                className="h-1.5 rounded-full"
                style={{
                  width: `${(liveStatus.newToday / Math.max(liveStatus.newToday, liveStatus.yesterday)) * 100}%`,
                  backgroundColor: "#185FA5",
                }}
              />
            </div>
            <p className="mt-1 text-[10px] font-normal text-subtle">
              Today {liveStatus.newToday} · Yesterday {liveStatus.yesterday}
            </p>
            <button
              type="button"
              className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-md px-2.5 py-1.5 text-[12px] font-medium text-ink"
              style={{ border: "0.5px solid var(--border)" }}
            >
              <RefreshIcon className="h-3.5 w-3.5" /> Refresh now
            </button>
          </Card>

          {/* Card 2 — watchlist */}
          <Card>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-[12px] font-medium text-ink">Watchlist</h3>
              <span className="rounded-full bg-[#F1EFE8] px-1.5 py-0.5 text-[10px] font-medium text-[#444441]">
                {watchEntries.length}
              </span>
            </div>
            <ul className="space-y-2">
              {watchEntries.map((w) => (
                <li key={w.name} className="flex items-center gap-2">
                  <span
                    className="h-[7px] w-[7px] shrink-0 rounded-full"
                    style={{ backgroundColor: STAGE_DOT[w.stage] }}
                  />
                  {w.companyId ? (
                    <Link
                      href={`/company/${w.companyId}`}
                      className="truncate text-[12px] font-medium text-ink hover:underline"
                    >
                      {w.name}
                    </Link>
                  ) : (
                    <span className="truncate text-[12px] font-medium text-ink">
                      {w.name}
                    </span>
                  )}
                  <span className="ml-auto flex shrink-0 items-center gap-1.5">
                    <StageBadge stage={w.stage} />
                    {w.eventToday && (
                      <span
                        className="h-1.5 w-1.5 rounded-full"
                        style={{ backgroundColor: "#185FA5" }}
                        title="New event in last 24h"
                      />
                    )}
                  </span>
                </li>
              ))}
              {watchEntries.length === 0 && (
                <li className="text-[11px] font-normal text-subtle">
                  No companies watched.
                </li>
              )}
            </ul>
            <Link
              href="/watchlist"
              className="mt-3 inline-block text-[11px] font-normal text-[#185FA5] hover:underline"
            >
              Manage watchlist
            </Link>
          </Card>

          {/* Card 3 — activity summary + date range */}
          <ActivitySummary initial={sidebarInitial} />

          {/* Card 4 — sectors active */}
          <Card>
            <h3 className="mb-2 text-[12px] font-medium text-ink">
              Sectors active this week
            </h3>
            <ul className="space-y-2">
              {sectorsActive.map((s) => {
                const max = Math.max(...sectorsActive.map((x) => x.count));
                return (
                  <li key={s.label} className="flex items-center gap-2">
                    <span className="w-28 shrink-0 truncate text-[11px] font-normal text-muted">
                      {s.label}
                    </span>
                    <div className="h-1.5 flex-1 rounded-full bg-[#F1EFE8]">
                      <div
                        className="h-1.5 rounded-full"
                        style={{
                          width: `${(s.count / max) * 100}%`,
                          backgroundColor: "#185FA5",
                        }}
                      />
                    </div>
                    <span className="w-4 shrink-0 text-right text-[11px] font-medium text-ink">
                      {s.count}
                    </span>
                  </li>
                );
              })}
            </ul>
          </Card>
        </aside>
      </div>
    </div>
  );
}

// ---- day group ----
function DayGroup({
  label,
  items,
  children,
}: {
  label: string;
  items: FeedItemData[];
  children: React.ReactNode;
}) {
  const stageChanges = items.filter((i) => STAGE_CHANGE_TYPES.includes(i.type)).length;
  const newEntries = items.filter((i) => i.type === "new_entry").length;
  const flagged = items.filter((i) => i.type === "flagged").length;
  const parts: string[] = [];
  if (stageChanges)
    parts.push(`${stageChanges} stage change${stageChanges > 1 ? "s" : ""}`);
  if (newEntries) parts.push(`${newEntries} new ${newEntries > 1 ? "entries" : "entry"}`);
  if (flagged) parts.push(`${flagged} flagged`);

  return (
    <section className="mb-3">
      {/* centered divider */}
      <div className="relative flex items-center py-3">
        <span className="h-px flex-1" style={{ backgroundColor: "var(--border)" }} />
        <span className="px-3 text-[11px] font-medium uppercase tracking-wide text-muted">
          {label}
        </span>
        <span className="h-px flex-1" style={{ backgroundColor: "var(--border)" }} />
      </div>
      {parts.length > 0 && (
        <p className="mb-1 text-center text-[11px] font-normal text-subtle">
          {parts.join(" · ")}
        </p>
      )}
      <div>{children}</div>
    </section>
  );
}

// ---- empty state ----
function EmptyState({ onClear }: { onClear: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <InboxIcon className="h-12 w-12 text-subtle" />
      <p className="mt-4 text-[14px] font-medium text-ink">
        No events match your filters
      </p>
      <p className="mt-1 text-[13px] font-normal text-muted">
        Try removing a filter or expanding your date range
      </p>
      <button
        type="button"
        onClick={onClear}
        className="mt-4 rounded-md px-3 py-1.5 text-[12px] font-medium text-white"
        style={{ backgroundColor: "#185FA5" }}
      >
        Clear all filters
      </button>
    </div>
  );
}

// ---- small helpers ----
function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors"
      style={
        active
          ? {
              backgroundColor: "#E6F1FB",
              color: "#0C447C",
              boxShadow: "inset 0 0 0 0.5px #185FA5",
            }
          : {
              backgroundColor: "var(--surface)",
              color: "var(--text-muted)",
              boxShadow: "inset 0 0 0 0.5px var(--border)",
            }
      }
    >
      {children}
    </button>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="rounded-lg bg-surface p-3"
      style={{ border: "0.5px solid var(--border)" }}
    >
      {children}
    </div>
  );
}

// ---- activity summary card (date range + range-aware stats) ----
function ActivitySummary({ initial }: { initial?: CommittedRange }) {
  const r = useDateRange(initial);
  const mockStats = statsFor(r.committed.preset);
  const dist = distributionFor(r.committed.preset, r.committed.from, r.committed.to);
  const distMax = Math.max(...dist.map((d) => d.count), 1);
  const showDistLabels = dist.length <= 8;

  // Live range-aware event counts from /api/stats/summary; mock fallback.
  const liveStats = useLive(
    `feed-rangestats-${r.committed.from}-${r.committed.to}`,
    async () =>
      (await api.stats(`?from=${r.committed.from}&to=${r.committed.to}`)).rangeStats,
    null as null | {
      stageChanges: number;
      newEntries: number;
      pulled: number;
      flagged: number;
      confidence: number;
    }
  );
  const stats =
    liveStats.source === "live" && liveStats.data ? liveStats.data : mockStats;

  const rows = [
    { label: "Stage changes", value: stats.stageChanges, color: "#185FA5" },
    { label: "New entries", value: stats.newEntries, color: "#27500A" },
    { label: "Pulled / lapsed", value: stats.pulled, color: "#E24B4A" },
    { label: "Flagged for review", value: stats.flagged, color: "#BA7517" },
    { label: "Confidence updates", value: stats.confidence, color: "#9A9890" },
  ];

  const href = `/analytics?from=${r.committed.from}&to=${r.committed.to}&range=${presetToToken(r.committed.preset)}`;

  return (
    <Card>
      <h3 className="mb-2 text-[12px] font-medium text-ink">Activity summary</h3>

      {/* Section A — range selector */}
      <DateRangeControl
        selected={r.selected}
        from={r.from}
        to={r.to}
        onSelect={r.selectPreset}
        onFromChange={r.setFrom}
        onToChange={r.setTo}
        onApply={r.apply}
      />

      <p className="mt-2 text-[10px] font-normal text-subtle">
        {r.committed.preset === "custom"
          ? `Custom range · ${formatDate(r.committed.from)} – ${formatDate(r.committed.to)}`
          : PRESET_LABEL[r.committed.preset]}
      </p>

      {/* Section B — stats */}
      <ul className="mt-2 space-y-1.5">
        {rows.map((row) => (
          <li key={row.label} className="flex items-center gap-2 text-[12px]">
            <span
              className="h-1.5 w-1.5 shrink-0 rounded-full"
              style={{ backgroundColor: row.color }}
            />
            <span className="font-normal text-muted">{row.label}</span>
            <span className="ml-auto font-medium text-ink">{row.value}</span>
          </li>
        ))}
      </ul>

      {/* distribution */}
      <div className="mt-3 flex items-end gap-1.5" style={{ height: 48 }}>
        {dist.map((d, i) => (
          <div
            key={`${d.label}-${i}`}
            className="flex flex-1 flex-col items-center gap-1"
          >
            <div className="flex h-9 w-full items-end">
              <div
                className="w-full rounded-sm"
                style={{
                  height: `${Math.max(8, (d.count / distMax) * 100)}%`,
                  backgroundColor: d.highlight ? "#185FA5" : "#9CC1E8",
                }}
                title={`${d.label}: ${d.count} events`}
              />
            </div>
            {showDistLabels && (
              <span className="text-[9px] font-normal text-subtle">{d.label}</span>
            )}
          </div>
        ))}
      </div>

      <Link
        href={href}
        className="mt-3 inline-flex w-full items-center justify-center rounded-md px-2.5 py-1.5 text-[12px] font-medium"
        style={{ backgroundColor: "#E6F1FB", color: "#0C447C" }}
      >
        Full analytics
      </Link>
    </Card>
  );
}
