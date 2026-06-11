"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { DealTypeBadge } from "./DealTypeBadge";
import { STAGE_COLORS, SECTOR_LABELS } from "@/lib/colors";
import {
  applyCompsFilter,
  compsToCSV,
  sizeBand,
  EMPTY_FILTER,
  type CompResult,
  type CompsFilter,
} from "@/lib/comps";

const STAGE_DOT: Record<string, string> = {
  in_market: STAGE_COLORS.in_market.text,
  monitor_for_exit: STAGE_COLORS.monitor_for_exit.text,
  on_hold: STAGE_COLORS.on_hold.text,
  pulled: STAGE_COLORS.pulled.text,
};

function downloadCSV(csv: string, filename: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function CompsSection({ comps }: { comps: CompResult[] }) {
  const [filter, setFilter] = useState<CompsFilter>(EMPTY_FILTER);

  const sectors = useMemo(() => [...new Set(comps.map((c) => c.sector))].sort(), [comps]);
  const hasSizeData = useMemo(
    () => comps.some((c) => sizeBand(c.revenue) ?? sizeBand(c.ebitda)),
    [comps]
  );
  const hasClosedAt = useMemo(() => comps.some((c) => c.closedAt), [comps]);

  const filtered = useMemo(() => applyCompsFilter(comps, filter), [comps, filter]);

  const active =
    filter.sector ||
    filter.sizeBand ||
    filter.dealType ||
    filter.outcome ||
    filter.closedAfter ||
    filter.closedBefore;

  function set<K extends keyof CompsFilter>(k: K, v: CompsFilter[K]) {
    setFilter((f) => ({ ...f, [k]: v }));
  }

  if (comps.length === 0) return null;

  return (
    <div>
      {/* filter row */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {sectors.length > 1 && (
          <select
            value={filter.sector}
            onChange={(e) => set("sector", e.target.value)}
            className="rounded border border-[var(--border)] bg-white px-2 py-1 text-[11px] text-ink"
          >
            <option value="">All sectors</option>
            {sectors.map((s) => (
              <option key={s} value={s}>
                {(SECTOR_LABELS as Record<string, string>)[s] ?? s}
              </option>
            ))}
          </select>
        )}

        {hasSizeData && (
          <select
            value={filter.sizeBand}
            onChange={(e) => set("sizeBand", e.target.value as CompsFilter["sizeBand"])}
            className="rounded border border-[var(--border)] bg-white px-2 py-1 text-[11px] text-ink"
          >
            <option value="">All sizes</option>
            <option value="small">Small (&lt;$200M)</option>
            <option value="mid">Mid ($200M–$1B)</option>
            <option value="large">Large (&gt;$1B)</option>
          </select>
        )}

        <select
          value={filter.dealType}
          onChange={(e) => set("dealType", e.target.value)}
          className="rounded border border-[var(--border)] bg-white px-2 py-1 text-[11px] text-ink"
        >
          <option value="">All types</option>
          <option value="carveout">Carveout</option>
          <option value="private_asset">Private asset</option>
        </select>

        <select
          value={filter.outcome}
          onChange={(e) => set("outcome", e.target.value)}
          className="rounded border border-[var(--border)] bg-white px-2 py-1 text-[11px] text-ink"
        >
          <option value="">All outcomes</option>
          <option value="closed">Closed</option>
          <option value="withdrawn">Withdrawn</option>
        </select>

        {hasClosedAt && (
          <>
            <input
              type="date"
              value={filter.closedAfter}
              onChange={(e) => set("closedAfter", e.target.value)}
              className="rounded border border-[var(--border)] bg-white px-2 py-1 text-[11px] text-ink"
              title="Closed after"
            />
            <input
              type="date"
              value={filter.closedBefore}
              onChange={(e) => set("closedBefore", e.target.value)}
              className="rounded border border-[var(--border)] bg-white px-2 py-1 text-[11px] text-ink"
              title="Closed before"
            />
          </>
        )}

        {active && (
          <button
            onClick={() => setFilter(EMPTY_FILTER)}
            className="text-[11px] text-[#185FA5] hover:underline"
          >
            Clear
          </button>
        )}

        <button
          onClick={() => downloadCSV(compsToCSV(filtered), "comparable-deals.csv")}
          className="ml-auto rounded border border-[var(--border)] bg-white px-2 py-1 text-[11px] text-ink hover:bg-[#F5F4EF]"
        >
          Export CSV
        </button>
      </div>

      {/* count */}
      {active && (
        <p className="mb-2 text-[11px] text-subtle">
          {filtered.length} of {comps.length} comps
        </p>
      )}

      {/* list */}
      {filtered.length === 0 ? (
        <p className="text-[12px] text-subtle">No comps match the current filters.</p>
      ) : (
        <ul className="space-y-2">
          {filtered.map((c) => (
            <li key={c.id}>
              <Link
                href={`/company/${c.id}`}
                className="block rounded-md px-2 py-2 hover:bg-[#F5F4EF]"
              >
                <div className="flex items-center gap-2">
                  <span
                    className="h-1.5 w-1.5 shrink-0 rounded-full"
                    style={{ backgroundColor: STAGE_DOT[c.stage] ?? "#9A9890" }}
                  />
                  <span className="truncate text-[13px] font-normal text-ink">
                    {c.name}
                  </span>
                  {c.closeMultiple && (
                    <span className="ml-1 shrink-0 text-[11px] font-medium text-[#157A5A]">
                      {c.closeMultiple}
                    </span>
                  )}
                  <span className="ml-auto shrink-0">
                    <DealTypeBadge type={c.dealType as import("@/lib/types").DealType} />
                  </span>
                </div>
                <p className="ml-3 mt-0.5 text-[11px] font-normal text-subtle">
                  {c.matchReasons.join(" · ")}
                  {c.closedAt && (
                    <span className="ml-2 text-muted">
                      ·{" "}
                      {new Date(c.closedAt + "T00:00:00").toLocaleDateString("en-US", {
                        month: "short",
                        year: "numeric",
                      })}
                    </span>
                  )}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
