"use client";

import { useMemo, useState } from "react";
import { RadarCompanyCard } from "@/components/ui/RadarCompanyCard";
import { RadarTable, type SortKey, type SortDir, type GroupBy } from "@/components/ui/RadarTable";
import { SearchBar } from "@/components/ui/SearchBar";
import {
  ColumnsIcon,
  RowsIcon,
  PlusIcon,
  ChevronDownIcon,
  ChevronUpIcon,
} from "@/components/ui/icons";
import {
  radarCompanies,
  summaryStrip,
  sectorSummary,
  sponsorOptions,
  MOST_ACTIVE_SECTOR,
  type RadarCompany,
} from "@/lib/radar-data";
import { STAGE_COLORS, SECTOR_LABELS, SECTORS } from "@/lib/colors";
import { cn } from "@/lib/format";
import type { Sector, DealType, Confidence, Stage } from "@/lib/types";

const CONF_RANK: Record<Confidence, number> = { high: 4, medium: 3, low: 2, needs_review: 1 };

function sortList(rows: RadarCompany[], key: SortKey, dir: SortDir): RadarCompany[] {
  const s = [...rows].sort((a, b) => {
    let d = 0;
    if (key === "name") d = a.name.localeCompare(b.name);
    else if (key === "days") d = a.days - b.days;
    else if (key === "added") d = a.added.localeCompare(b.added);
    else d = CONF_RANK[a.confidence] - CONF_RANK[b.confidence];
    return dir === "asc" ? d : -d;
  });
  return s;
}

const COLUMNS: { id: string; title: string; stages: Stage[]; color: Stage }[] = [
  { id: "in", title: "In market", stages: ["in_market"], color: "in_market" },
  { id: "mon", title: "Monitor for exit", stages: ["monitor_for_exit"], color: "monitor_for_exit" },
  { id: "hold", title: "On hold / Pulled", stages: ["on_hold", "pulled"], color: "on_hold" },
];

const SORT_OPTIONS: { id: string; label: string; key: SortKey; dir: SortDir }[] = [
  { id: "days_desc", label: "Days in stage (longest)", key: "days", dir: "desc" },
  { id: "name_asc", label: "Company name A→Z", key: "name", dir: "asc" },
  { id: "name_desc", label: "Company name Z→A", key: "name", dir: "desc" },
  { id: "added_desc", label: "Most recently added", key: "added", dir: "desc" },
  { id: "conf_desc", label: "Confidence (high first)", key: "confidence", dir: "desc" },
  { id: "conf_asc", label: "Confidence (low first)", key: "confidence", dir: "asc" },
];

const COL_SORT: { id: string; label: string; key: SortKey; dir: SortDir }[] = [
  { id: "days", label: "Days in stage", key: "days", dir: "desc" },
  { id: "name", label: "Name", key: "name", dir: "asc" },
  { id: "confidence", label: "Confidence", key: "confidence", dir: "desc" },
  { id: "added", label: "Recently added", key: "added", dir: "desc" },
];

const ALL_STAGES: Stage[] = ["in_market", "monitor_for_exit", "on_hold", "pulled"];
const ALL_CONF: Confidence[] = ["high", "medium", "low", "needs_review"];
const CONF_LABEL: Record<Confidence, string> = { high: "High", medium: "Medium", low: "Low", needs_review: "Needs review" };

export default function RadarPage() {
  const [view, setView] = useState<"kanban" | "table">("kanban");
  const [sector, setSector] = useState<Sector | "all">("all");
  const [deal, setDeal] = useState<DealType | "all">("all");
  const [confidence, setConfidence] = useState<Set<Confidence>>(new Set());
  const [stages, setStages] = useState<Set<Stage>>(new Set());
  const [sponsor, setSponsor] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("days");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [groupBy, setGroupBy] = useState<GroupBy>("none");
  const [watch, setWatch] = useState<Set<string>>(
    () => new Set(radarCompanies.filter((c) => c.watchlisted).map((c) => c.id))
  );
  const [colSort, setColSort] = useState<Record<string, string>>({ in: "days", mon: "days", hold: "days" });
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [shown, setShown] = useState<Record<string, number>>({});
  const [toast, setToast] = useState(false);
  const [newThisWeek, setNewThisWeek] = useState(false);

  // "this week" = added on/after 7 days before the mock anchor (2026-06-03)
  const WEEK_CUTOFF = "2026-05-27";

  const sortId = SORT_OPTIONS.find((o) => o.key === sortKey && o.dir === sortDir)?.id ?? "";

  function toggleSet<T>(setter: (f: (s: Set<T>) => Set<T>) => void, value: T) {
    setter((prev) => {
      const n = new Set(prev);
      if (n.has(value)) n.delete(value);
      else n.add(value);
      return n;
    });
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return radarCompanies.filter((c) => {
      if (sector !== "all" && c.sector !== sector) return false;
      if (deal !== "all" && c.dealType !== deal) return false;
      if (confidence.size && !confidence.has(c.confidence)) return false;
      if (stages.size && !stages.has(c.stage)) return false;
      if (sponsor !== "all" && c.ownerName !== sponsor) return false;
      if (newThisWeek && c.added < WEEK_CUTOFF) return false;
      if (q) {
        const hay = `${c.name} ${c.ownerName} ${SECTOR_LABELS[c.sector]}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [sector, deal, confidence, stages, sponsor, search, newThisWeek]);

  const activeCount =
    (sector !== "all" ? 1 : 0) +
    (deal !== "all" ? 1 : 0) +
    confidence.size +
    stages.size +
    (sponsor !== "all" ? 1 : 0) +
    (newThisWeek ? 1 : 0) +
    (search.trim() ? 1 : 0);

  function clearAll() {
    setSector("all");
    setDeal("all");
    setConfidence(new Set());
    setStages(new Set());
    setSponsor("all");
    setSearch("");
    setNewThisWeek(false);
  }

  // Summary-strip quick filters: reset everything, then apply one category.
  type Quick = "total" | "in_market" | "monitor" | "hold" | "needs_review" | "new_week";
  function applyQuick(kind: Quick) {
    setSector("all");
    setDeal("all");
    setSponsor("all");
    setSearch("");
    setConfidence(kind === "needs_review" ? new Set<Confidence>(["needs_review"]) : new Set());
    setStages(
      kind === "in_market"
        ? new Set<Stage>(["in_market"])
        : kind === "monitor"
        ? new Set<Stage>(["monitor_for_exit"])
        : kind === "hold"
        ? new Set<Stage>(["on_hold", "pulled"])
        : new Set()
    );
    setNewThisWeek(kind === "new_week");
  }

  const exactStages = (arr: Stage[]) => stages.size === arr.length && arr.every((s) => stages.has(s));
  const activeQuick: Record<Quick, boolean> = {
    total: activeCount === 0,
    in_market: exactStages(["in_market"]) && confidence.size === 0,
    monitor: exactStages(["monitor_for_exit"]) && confidence.size === 0,
    hold: exactStages(["on_hold", "pulled"]) && confidence.size === 0,
    needs_review: confidence.has("needs_review") && confidence.size === 1 && stages.size === 0,
    new_week: newThisWeek,
  };

  function onTableSort(key: SortKey) {
    // toggle direction if same key, else sensible default
    const dir: SortDir = sortKey === key ? (sortDir === "asc" ? "desc" : "asc") : key === "name" ? "asc" : "desc";
    setSortKey(key);
    setSortDir(dir);
  }

  return (
    <div>
      {/* ===== SECTION 1 — control bar (sticky) ===== */}
      <div
        className="sticky top-14 z-10 -mx-6 bg-bg/95 px-6 py-2.5 backdrop-blur"
        style={{ borderBottom: "0.5px solid var(--border)" }}
      >
        {/* Row A */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="text-[12px] font-normal text-subtle">
              Arbor <span className="px-1">›</span> <span className="text-muted">Radar</span>
            </span>
            <div className="flex rounded-md p-0.5" style={{ border: "0.5px solid var(--border)" }}>
              <IconToggle active={view === "kanban"} onClick={() => setView("kanban")} label="Kanban view">
                <ColumnsIcon className="h-4 w-4" />
              </IconToggle>
              <IconToggle active={view === "table"} onClick={() => setView("table")} label="Table view">
                <RowsIcon className="h-4 w-4" />
              </IconToggle>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <SearchBar onSearch={setSearch} className="w-64" placeholder="Search company, sponsor, sector…" />
            <button
              type="button"
              onClick={() => {
                setToast(true);
                setTimeout(() => setToast(false), 2000);
              }}
              className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[12px] font-medium text-muted hover:text-ink"
              style={{ border: "0.5px solid var(--border)" }}
            >
              <PlusIcon className="h-3.5 w-3.5" /> Add company
            </button>
          </div>
        </div>

        {/* Row B — chips */}
        <div className="mt-2 flex items-center gap-1.5 overflow-x-auto pb-1">
          {activeCount > 0 && (
            <span className="mr-1 shrink-0 rounded-full bg-[#E6F1FB] px-2 py-1 text-[11px] font-medium text-[#0C447C]">
              Filters {activeCount}
            </span>
          )}
          <Chip active={sector === "all"} onClick={() => setSector("all")}>All</Chip>
          {SECTORS.map((s) => (
            <Chip key={s} active={sector === s} onClick={() => setSector(sector === s ? "all" : s)}>
              {SECTOR_LABELS[s]}
            </Chip>
          ))}
          <Divider />
          <Chip active={deal === "all"} onClick={() => setDeal("all")}>All</Chip>
          <Chip active={deal === "carveout"} onClick={() => setDeal("carveout")}>Carveouts</Chip>
          <Chip active={deal === "private_asset"} onClick={() => setDeal("private_asset")}>Private assets</Chip>
          <Divider />
          {ALL_CONF.map((cf) => (
            <Chip key={cf} active={confidence.has(cf)} onClick={() => toggleSet(setConfidence, cf)}>
              {CONF_LABEL[cf]}
            </Chip>
          ))}
          <Divider />
          {ALL_STAGES.map((st) => (
            <Chip key={st} active={stages.has(st)} onClick={() => toggleSet(setStages, st)}>
              {st === "in_market" ? "In market" : st === "monitor_for_exit" ? "Monitor" : st === "on_hold" ? "On hold" : "Pulled"}
            </Chip>
          ))}
          <Divider />
          <select
            value={sponsor}
            onChange={(e) => setSponsor(e.target.value)}
            className="shrink-0 rounded-full bg-surface px-2.5 py-1 text-[11px] font-medium text-muted"
            style={{ boxShadow: "inset 0 0 0 0.5px var(--border)" }}
          >
            <option value="all">All sponsors</option>
            {sponsorOptions.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          {activeCount > 0 && (
            <button type="button" onClick={clearAll} className="ml-auto shrink-0 px-2 text-[11px] font-medium text-[#791F1F] hover:underline">
              Clear all filters
            </button>
          )}
        </div>

        {/* Row C — sort / group / count */}
        <div className="mt-1 flex flex-wrap items-center justify-end gap-3 text-[11px]">
          <span className="mr-auto text-subtle">
            Showing {filtered.length} of {summaryStrip.total.toLocaleString()} companies
          </span>
          <label className="flex items-center gap-1.5 text-muted">
            Sort
            <select
              value={sortId}
              onChange={(e) => {
                const o = SORT_OPTIONS.find((x) => x.id === e.target.value);
                if (o) {
                  setSortKey(o.key);
                  setSortDir(o.dir);
                }
              }}
              className="rounded-md bg-surface px-1.5 py-1 text-ink"
              style={{ border: "0.5px solid var(--border)" }}
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.id} value={o.id}>{o.label}</option>
              ))}
            </select>
          </label>
          {view === "table" && (
            <label className="flex items-center gap-1.5 text-muted">
              Group
              <select value={groupBy} onChange={(e) => setGroupBy(e.target.value as GroupBy)} className="rounded-md bg-surface px-1.5 py-1 text-ink" style={{ border: "0.5px solid var(--border)" }}>
                <option value="none">No grouping</option>
                <option value="sector">By sector</option>
                <option value="deal_type">By deal type</option>
                <option value="sponsor">By sponsor</option>
              </select>
            </label>
          )}
        </div>
      </div>

      {/* ===== SECTION 2 — summary strip ===== */}
      <div className="-mx-6 mb-4 flex flex-wrap bg-[#F5F4EF] px-6 py-3" style={{ borderTop: "0.5px solid var(--border)", borderBottom: "0.5px solid var(--border)" }}>
        <Block label="Total tracked" value={summaryStrip.total.toLocaleString()} sub="across 7 sectors" active={activeQuick.total} onClick={() => applyQuick("total")} />
        <Block label="In market" value={String(summaryStrip.inMarket)} color="#0C447C" sub="↑ 12 this week" active={activeQuick.in_market} onClick={() => applyQuick("in_market")} />
        <Block label="Monitor for exit" value={String(summaryStrip.monitor)} color="#633806" sub="↓ 4 this week" active={activeQuick.monitor} onClick={() => applyQuick("monitor")} />
        <Block label="On hold / Pulled" value={String(summaryStrip.onHold)} color="#791F1F" sub="→ no change" active={activeQuick.hold} onClick={() => applyQuick("hold")} />
        <Block
          label="Needs review"
          value={String(summaryStrip.needsReview)}
          color="#633806"
          sub="requires analyst action"
          pulse
          active={activeQuick.needs_review}
          onClick={() => applyQuick("needs_review")}
        />
        <Block label="New this week" value={String(summaryStrip.newThisWeek)} color="#27500A" sub="6 carveouts · 2 private" last active={activeQuick.new_week} onClick={() => applyQuick("new_week")} />
      </div>

      {/* ===== sector summary cards ===== */}
      <div className="mb-5 flex gap-2 overflow-x-auto pb-1">
        {sectorSummary.map((s) => {
          const active = sector === s.key;
          const total = s.inMarket + s.monitor + s.onHold;
          return (
            <button
              key={s.key}
              type="button"
              onClick={() => setSector(active ? "all" : s.key)}
              className="shrink-0 rounded-lg bg-surface p-3 text-left"
              style={{ width: 168, border: active ? "1px solid #185FA5" : "0.5px solid var(--border)" }}
            >
              <div className="flex items-center justify-between">
                <span className="text-[12px] font-medium text-ink">{s.label}</span>
                {s.key === MOST_ACTIVE_SECTOR && (
                  <span className="rounded bg-[#E6F1FB] px-1 py-0.5 text-[9px] font-medium text-[#0C447C]">Most active</span>
                )}
              </div>
              <div className="mt-1 text-[11px] font-normal text-muted">{s.total} total · {s.inMarket} in market</div>
              <div className="mt-2 flex h-1.5 overflow-hidden rounded-full">
                <span style={{ width: `${(s.inMarket / total) * 100}%`, backgroundColor: STAGE_COLORS.in_market.border ?? "#185FA5" }} />
                <span style={{ width: `${(s.monitor / total) * 100}%`, backgroundColor: STAGE_COLORS.monitor_for_exit.border ?? "#BA7517" }} />
                <span style={{ width: `${(s.onHold / total) * 100}%`, backgroundColor: "#B4B2A9" }} />
              </div>
            </button>
          );
        })}
      </div>

      {/* ===== SECTION 3 — main ===== */}
      {view === "kanban" ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {COLUMNS.map((col) => {
            const cs = COL_SORT.find((o) => o.id === colSort[col.id]) ?? COL_SORT[0];
            const cards = sortList(filtered.filter((c) => col.stages.includes(c.stage)), cs.key, cs.dir);
            const isCollapsed = collapsed.has(col.id);
            const limit = shown[col.id] ?? 15;
            const visible = cards.slice(0, limit);
            const accent = STAGE_COLORS[col.color].border ?? "#888";
            return (
              <section key={col.id} className="rounded-lg bg-surface" style={{ border: "0.5px solid var(--border)" }}>
                <span className="block h-[3px] rounded-t-lg" style={{ backgroundColor: accent }} />
                <header className="flex items-center justify-between gap-2 px-3 py-2">
                  <div className="flex items-center gap-2">
                    <h2 className="text-[13px] font-medium text-ink">{col.title}</h2>
                    <span className="rounded-full bg-[#F1EFE8] px-1.5 py-0.5 text-[10px] font-medium text-[#444441]">{cards.length}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    {!isCollapsed && (
                      <select
                        value={colSort[col.id]}
                        onChange={(e) => setColSort((p) => ({ ...p, [col.id]: e.target.value }))}
                        className="rounded bg-surface px-1 py-0.5 text-[10px] text-muted"
                        style={{ border: "0.5px solid var(--border)" }}
                      >
                        {COL_SORT.map((o) => (
                          <option key={o.id} value={o.id}>{o.label}</option>
                        ))}
                      </select>
                    )}
                    <button
                      type="button"
                      aria-label="Collapse column"
                      onClick={() => toggleSet(setCollapsed, col.id)}
                      className="text-muted hover:text-ink"
                    >
                      {isCollapsed ? <ChevronDownIcon className="h-4 w-4" /> : <ChevronUpIcon className="h-4 w-4" />}
                    </button>
                  </div>
                </header>
                {!isCollapsed && (
                  <div className="space-y-2 overflow-y-auto px-2 pb-2" style={{ maxHeight: "calc(100vh - 280px)" }}>
                    {visible.map((c) => (
                      <RadarCompanyCard
                        key={c.id}
                        c={c}
                        watched={watch.has(c.id)}
                        onToggleWatch={() => toggleSet(setWatch, c.id)}
                      />
                    ))}
                    {cards.length === 0 && <p className="py-8 text-center text-[11px] text-subtle">No companies</p>}
                    {cards.length > limit && (
                      <button
                        type="button"
                        onClick={() => setShown((p) => ({ ...p, [col.id]: cards.length }))}
                        className="w-full rounded-md py-1.5 text-[11px] font-medium text-[#185FA5]"
                        style={{ border: "0.5px solid var(--border)" }}
                      >
                        Show {cards.length - limit} more
                      </button>
                    )}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      ) : (
        <RadarTable
          rows={filtered}
          sortKey={sortKey}
          sortDir={sortDir}
          onSort={onTableSort}
          groupBy={groupBy}
          watch={watch}
          onToggleWatch={(id) => toggleSet(setWatch, id)}
          onClearFilters={clearAll}
        />
      )}

      {/* toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-40 rounded-md px-3 py-2 text-[12px] font-medium text-white shadow-lg" style={{ backgroundColor: "#1A1A18" }}>
          Add company — coming soon
        </div>
      )}
    </div>
  );
}

// ===== helpers =====
function IconToggle({ active, onClick, label, children }: { active: boolean; onClick: () => void; label: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      className="rounded p-1.5 transition-colors"
      style={active ? { backgroundColor: "#E6F1FB", color: "#0C447C" } : { color: "var(--text-muted)" }}
    >
      {children}
    </button>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="shrink-0 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors"
      style={active ? { backgroundColor: "#E6F1FB", color: "#0C447C", boxShadow: "inset 0 0 0 0.5px #185FA5" } : { backgroundColor: "var(--surface)", color: "var(--text-muted)", boxShadow: "inset 0 0 0 0.5px var(--border)" }}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <span className="mx-0.5 h-4 w-px shrink-0" style={{ backgroundColor: "var(--border)" }} />;
}

function Block({
  label,
  value,
  sub,
  color,
  pulse,
  last,
  active,
  onClick,
}: {
  label: string;
  value: string;
  sub: string;
  color?: string;
  pulse?: boolean;
  last?: boolean;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group flex-1 cursor-pointer rounded-md px-4 py-1 text-left transition-colors hover:bg-white",
        !last && "border-r"
      )}
      style={{
        borderColor: last ? "transparent" : "var(--border)",
        minWidth: 150,
        boxShadow: active ? "inset 0 0 0 1px #185FA5" : undefined,
        backgroundColor: active ? "#fff" : undefined,
      }}
      title={`Show ${label} companies`}
    >
      <div className="flex items-center gap-1 text-[11px] font-normal text-muted">
        {label}
        <span className="opacity-0 transition-opacity group-hover:opacity-60">→</span>
      </div>
      <div className="mt-0.5 flex items-center gap-1.5 text-[20px] font-medium leading-tight" style={{ color: color ?? "var(--text)" }}>
        {value}
        {pulse && (
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full rounded-full animate-ping-dot" style={{ backgroundColor: "#E24B4A" }} />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full" style={{ backgroundColor: "#E24B4A" }} />
          </span>
        )}
      </div>
      <div className="text-[11px] font-normal text-subtle">{sub}</div>
    </button>
  );
}
