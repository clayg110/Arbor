"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { DealTypeBadge } from "./DealTypeBadge";
import { SectorBadge } from "./SectorBadge";
import { StageBadge } from "./StageBadge";
import { ConfidenceBadge } from "./ConfidenceBadge";
import { ConvictionBadge } from "./ConvictionBadge";
import { SignalSourceBadge } from "./SignalSourceBadge";
import {
  StarIcon,
  ArrowRightIcon,
  ChevronUpIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  SearchIcon,
} from "./icons";
import { STAGE_COLORS, SECTOR_LABELS, DEAL_TYPE_LABELS } from "@/lib/colors";
import { formatDate } from "@/lib/format";
import type { RadarCompany } from "@/lib/radar-data";

export type SortKey = "name" | "days" | "added" | "confidence" | "conviction";
export type SortDir = "asc" | "desc";
export type GroupBy = "none" | "sector" | "deal_type" | "sponsor";

const CONF_RANK: Record<RadarCompany["confidence"], number> = {
  high: 4,
  medium: 3,
  low: 2,
  needs_review: 1,
};

function sortRows(rows: RadarCompany[], key: SortKey, dir: SortDir): RadarCompany[] {
  const s = [...rows].sort((a, b) => {
    let d = 0;
    if (key === "name") d = a.name.localeCompare(b.name);
    else if (key === "days") d = a.days - b.days;
    else if (key === "added") d = a.added.localeCompare(b.added);
    else if (key === "conviction")
      d = (a.conviction?.score ?? 0) - (b.conviction?.score ?? 0);
    else d = CONF_RANK[a.confidence] - CONF_RANK[b.confidence];
    return dir === "asc" ? d : -d;
  });
  return s;
}

export function RadarTable({
  rows,
  sortKey,
  sortDir,
  onSort,
  groupBy,
  watch,
  onToggleWatch,
  onClearFilters,
}: {
  rows: RadarCompany[];
  sortKey: SortKey;
  sortDir: SortDir;
  onSort: (k: SortKey) => void;
  groupBy: GroupBy;
  watch: Set<string>;
  onToggleWatch: (id: string) => void;
  onClearFilters: () => void;
}) {
  const router = useRouter();
  const [perPage, setPerPage] = useState(25);
  const [page, setPage] = useState(0);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const sorted = useMemo(
    () => sortRows(rows, sortKey, sortDir),
    [rows, sortKey, sortDir]
  );
  const maxDays = Math.max(...rows.map((r) => r.days), 1);

  // grouping
  const groups: { key: string; label: string; rows: RadarCompany[] }[] = useMemo(() => {
    if (groupBy === "none") return [{ key: "all", label: "", rows: sorted }];
    const map = new Map<string, RadarCompany[]>();
    for (const r of sorted) {
      const k =
        groupBy === "sector"
          ? SECTOR_LABELS[r.sector]
          : groupBy === "deal_type"
            ? DEAL_TYPE_LABELS[r.dealType]
            : r.ownerName;
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(r);
    }
    return Array.from(map.entries()).map(([label, rs]) => ({
      key: label,
      label,
      rows: rs,
    }));
  }, [sorted, groupBy]);

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <SearchIcon className="h-10 w-10 text-subtle" />
        <p className="mt-4 text-[14px] font-medium text-ink">
          No companies match your filters
        </p>
        <button
          type="button"
          onClick={onClearFilters}
          className="mt-3 rounded-md px-3 py-1.5 text-[12px] font-medium text-white"
          style={{ backgroundColor: "#185FA5" }}
        >
          Clear all filters
        </button>
      </div>
    );
  }

  // pagination only when ungrouped
  const paged =
    groupBy === "none" ? sorted.slice(page * perPage, page * perPage + perPage) : sorted;
  const totalPages = Math.max(1, Math.ceil(sorted.length / perPage));

  return (
    <div
      className="rounded-lg bg-surface"
      style={{ border: "0.5px solid var(--border)" }}
    >
      <div className="overflow-x-auto">
        <table className="w-full text-left text-[12px]">
          <thead className="sticky top-[150px] z-[1] bg-[#F5F4EF]">
            <tr className="text-[10px] uppercase tracking-wide text-subtle">
              <Th
                sortable
                label="Company"
                active={sortKey === "name"}
                dir={sortDir}
                onClick={() => onSort("name")}
              />
              <Th label="Deal type" />
              <Th label="Sector" />
              <Th label="Stage" />
              <Th label="Sponsor / Parent" />
              <Th
                sortable
                rightAlign
                label="Days in stage"
                active={sortKey === "days"}
                dir={sortDir}
                onClick={() => onSort("days")}
              />
              <Th
                sortable
                label="Confidence"
                active={sortKey === "confidence"}
                dir={sortDir}
                onClick={() => onSort("confidence")}
              />
              <Th
                sortable
                rightAlign
                label="Conviction"
                active={sortKey === "conviction"}
                dir={sortDir}
                onClick={() => onSort("conviction")}
              />
              <Th label="Last signal" />
              <Th
                sortable
                label="Added"
                active={sortKey === "added"}
                dir={sortDir}
                onClick={() => onSort("added")}
              />
              <Th label="Actions" />
            </tr>
          </thead>
          <tbody>
            {groups.map((g) => {
              const isCollapsed = collapsed.has(g.key);
              const groupRows = groupBy === "none" ? paged : g.rows;
              const im = g.rows.filter((r) => r.stage === "in_market").length;
              const mo = g.rows.filter((r) => r.stage === "monitor_for_exit").length;
              const oh = g.rows.filter(
                (r) => r.stage === "on_hold" || r.stage === "pulled"
              ).length;
              return (
                <RowGroup key={g.key}>
                  {groupBy !== "none" && (
                    <tr
                      className="cursor-pointer bg-[#EDEBE4]"
                      onClick={() =>
                        setCollapsed((p) => {
                          const n = new Set(p);
                          if (n.has(g.key)) n.delete(g.key);
                          else n.add(g.key);
                          return n;
                        })
                      }
                    >
                      <td colSpan={11} className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          {isCollapsed ? (
                            <ChevronRightIcon className="h-3.5 w-3.5 text-muted" />
                          ) : (
                            <ChevronDownIcon className="h-3.5 w-3.5 text-muted" />
                          )}
                          <span className="text-[12px] font-medium text-ink">
                            {g.label}
                          </span>
                          <span className="rounded-full bg-surface px-1.5 py-0.5 text-[10px] font-medium text-muted">
                            {g.rows.length}
                          </span>
                          <span className="text-[11px] font-normal text-subtle">
                            {im} in market · {mo} monitoring · {oh} on hold
                          </span>
                        </div>
                      </td>
                    </tr>
                  )}
                  {!isCollapsed &&
                    groupRows.map((r, i) => (
                      <Row
                        key={r.id}
                        r={r}
                        even={i % 2 === 0}
                        maxDays={maxDays}
                        watched={watch.has(r.id)}
                        onToggleWatch={() => onToggleWatch(r.id)}
                        onOpen={() =>
                          r.companyId && router.push(`/company/${r.companyId}`)
                        }
                      />
                    ))}
                </RowGroup>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* pagination (ungrouped) */}
      {groupBy === "none" && (
        <div
          className="flex flex-wrap items-center justify-between gap-2 px-3 py-2"
          style={{ borderTop: "0.5px solid var(--border)" }}
        >
          <label className="flex items-center gap-1.5 text-[11px] text-muted">
            Rows per page
            <select
              value={perPage}
              onChange={(e) => {
                setPerPage(Number(e.target.value));
                setPage(0);
              }}
              className="rounded-md bg-surface px-1.5 py-1 text-[11px] text-ink"
              style={{ border: "0.5px solid var(--border)" }}
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </label>
          <div className="flex items-center gap-3 text-[11px]">
            <button
              type="button"
              disabled={page === 0}
              onClick={() => setPage((p) => p - 1)}
              className="rounded-md px-2 py-1 font-medium text-ink disabled:opacity-40"
              style={{ border: "0.5px solid var(--border)" }}
            >
              ‹ Previous
            </button>
            <span className="text-muted">
              Page {page + 1} of {totalPages}
            </span>
            <button
              type="button"
              disabled={page >= totalPages - 1}
              onClick={() => setPage((p) => p + 1)}
              className="rounded-md px-2 py-1 font-medium text-ink disabled:opacity-40"
              style={{ border: "0.5px solid var(--border)" }}
            >
              Next ›
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function RowGroup({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

function Th({
  label,
  sortable,
  active,
  dir,
  onClick,
  rightAlign,
}: {
  label: string;
  sortable?: boolean;
  active?: boolean;
  dir?: SortDir;
  onClick?: () => void;
  rightAlign?: boolean;
}) {
  return (
    <th
      className={`whitespace-nowrap px-3 py-2 font-normal ${rightAlign ? "text-right" : ""}`}
      style={{ borderBottom: "0.5px solid var(--border)" }}
    >
      {sortable ? (
        <button
          type="button"
          onClick={onClick}
          className={`inline-flex items-center gap-1 hover:text-ink ${active ? "text-ink" : ""}`}
        >
          {label}
          {active ? (
            dir === "asc" ? (
              <ChevronUpIcon className="h-3 w-3" />
            ) : (
              <ChevronDownIcon className="h-3 w-3" />
            )
          ) : (
            <span className="text-subtle">↕</span>
          )}
        </button>
      ) : (
        label
      )}
    </th>
  );
}

function Row({
  r,
  even,
  maxDays,
  watched,
  onToggleWatch,
  onOpen,
}: {
  r: RadarCompany;
  even: boolean;
  maxDays: number;
  watched: boolean;
  onToggleWatch: () => void;
  onOpen: () => void;
}) {
  const [hover, setHover] = useState(false);
  const stageColor = STAGE_COLORS[r.pulled ? "pulled" : r.stage];
  const owner = `${r.dealType === "carveout" ? "Parent" : "Sponsor"}: ${r.ownerName}`;
  return (
    <tr
      onClick={onOpen}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className={r.companyId ? "cursor-pointer" : ""}
      style={{
        backgroundColor: hover
          ? "rgba(230,241,251,0.5)"
          : even
            ? "var(--surface)"
            : "#FAF9F6",
        borderBottom: "0.5px solid var(--border)",
        opacity: r.pulled ? 0.78 : 1,
      }}
    >
      <td className="px-3 py-2">
        <span
          className="font-medium text-ink"
          style={r.pulled ? { textDecoration: "line-through" } : undefined}
        >
          {r.name}
        </span>
      </td>
      <td className="px-3 py-2">
        <DealTypeBadge type={r.dealType} />
      </td>
      <td className="px-3 py-2">
        <SectorBadge sector={r.sector} />
      </td>
      <td
        className="px-3 py-2"
        style={{ borderLeft: `3px solid ${stageColor.border ?? stageColor.text}` }}
      >
        {r.pulled ? (
          <span className="inline-flex items-center rounded-full bg-[#EDEBE4] px-2 py-0.5 text-[11px] font-medium text-[#555550]">
            Pulled
          </span>
        ) : (
          <StageBadge stage={r.stage} />
        )}
      </td>
      <td className="px-3 py-2 text-muted">{owner}</td>
      <td className="px-3 py-2 text-right">
        <div className="relative inline-flex min-w-[64px] items-center justify-end">
          <span
            className="absolute inset-y-0 left-0 rounded-sm"
            style={{
              width: `${(r.days / maxDays) * 100}%`,
              backgroundColor: `${stageColor.border ?? stageColor.text}22`,
            }}
          />
          <span className="relative font-medium text-ink">{r.days}</span>
        </div>
      </td>
      <td className="px-3 py-2">
        {r.pulled ? (
          <span className="text-subtle">—</span>
        ) : (
          <ConfidenceBadge confidence={r.confidence} />
        )}
      </td>
      <td className="px-3 py-2 text-right">
        {r.conviction ? (
          <ConvictionBadge score={r.conviction.score} band={r.conviction.band} />
        ) : (
          <span className="text-subtle">—</span>
        )}
      </td>
      <td className="px-3 py-2">
        <span className="inline-flex items-center gap-1.5 text-muted">
          <SignalSourceBadge source={r.lastSignal.source} />
          {r.lastSignal.label}
        </span>
      </td>
      <td className="px-3 py-2 text-muted">{formatDate(r.added)}</td>
      <td className="px-3 py-2">
        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={onToggleWatch}
            aria-label={watched ? "Unwatch" : "Watch"}
            className="text-muted hover:text-ink"
          >
            <StarIcon
              filled={watched}
              className="h-4 w-4"
              style={{ color: watched ? "#BA7517" : undefined }}
            />
          </button>
          {r.companyId && (
            <button
              type="button"
              onClick={onOpen}
              aria-label="Open profile"
              className="text-muted hover:text-ink"
            >
              <ArrowRightIcon className="h-4 w-4" />
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}
