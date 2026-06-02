"use client";

import { useMemo, useState } from "react";
import { KanbanColumn } from "@/components/ui/KanbanColumn";
import { SectorFilterBar, type SectorFilter } from "@/components/ui/SectorFilterBar";
import { SearchBar } from "@/components/ui/SearchBar";
import { mockCompanies } from "@/lib/mock-data";
import { cn } from "@/lib/format";
import type { DealType, Stage } from "@/lib/types";

type DealFilter = "all" | DealType;

const COLUMNS: { title: string; stage: Stage; stages: Stage[] }[] = [
  { title: "In market", stage: "in_market", stages: ["in_market"] },
  { title: "Monitor for exit", stage: "monitor_for_exit", stages: ["monitor_for_exit"] },
  { title: "On hold / Pulled", stage: "on_hold", stages: ["on_hold", "pulled"] },
];

const DEAL_OPTS: { v: DealFilter; label: string }[] = [
  { v: "all", label: "All" },
  { v: "carveout", label: "Carveouts" },
  { v: "private_asset", label: "Private assets" },
];

export default function RadarPage() {
  const [sector, setSector] = useState<SectorFilter>("all");
  const [deal, setDeal] = useState<DealFilter>("all");
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return mockCompanies.filter(
      (c) =>
        (sector === "all" || c.sector === sector) &&
        (deal === "all" || c.dealType === deal) &&
        (q === "" || c.name.toLowerCase().includes(q))
    );
  }, [sector, deal, query]);

  return (
    <div>
      {/* sector filter */}
      <div className="mb-4">
        <SectorFilterBar active={sector} onChange={setSector} />
      </div>

      {/* deal toggle + search */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div
          className="flex rounded-md bg-surface p-0.5"
          style={{ border: "0.5px solid var(--border)" }}
        >
          {DEAL_OPTS.map((o) => (
            <button
              key={o.v}
              type="button"
              onClick={() => setDeal(o.v)}
              className={cn(
                "rounded px-3 py-1 text-[12px] font-medium transition-colors",
                deal === o.v ? "text-white" : "text-muted hover:text-ink"
              )}
              style={deal === o.v ? { backgroundColor: "#185FA5" } : undefined}
            >
              {o.label}
            </button>
          ))}
        </div>

        <SearchBar onSearch={setQuery} className="w-72" />
      </div>

      {/* kanban */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {COLUMNS.map((col) => {
          const companies = filtered.filter((c) =>
            col.stages.includes(c.currentStage)
          );
          return (
            <KanbanColumn
              key={col.title}
              title={col.title}
              stage={col.stage}
              count={companies.length}
              companies={companies}
            />
          );
        })}
      </div>
    </div>
  );
}
