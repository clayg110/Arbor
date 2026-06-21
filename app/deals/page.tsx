"use client";

import { useMemo, useState } from "react";
import { useLive } from "@/lib/use-live";
import { api } from "@/lib/api-client";
import { radarCompanies, type RadarCompany } from "@/lib/radar-data";
import { buildDealRoom, rankDealRooms, type DealRoomInput } from "@/lib/deal-room";
import { DealRoomCard } from "@/components/ui/DealRoom";
import { cn } from "@/lib/format";

// A deal room exists for every company our team is actively running a process on
// (i.e. an "our process" stage is set). Map the radar row onto the cockpit input.
function toInput(c: RadarCompany): DealRoomInput {
  return {
    companyId: c.companyId ?? c.id,
    name: c.name,
    dealType: c.dealType,
    sector: c.sector,
    ownerName: c.ownerName,
    marketStage: c.stage,
    processStage: c.ourProcessStage ?? null,
    keyDates: c.processKeyDates ?? null,
    conviction: c.conviction,
    marketTiming: c.marketTiming,
    lastSignalDaysAgo: c.lastSignal.daysAgo,
  };
}

type Filter = "all" | "now" | "soon";

export default function DealsPage() {
  const live = useLive(
    "deals",
    () => api.companies("?limit=500"),
    {
      companies: radarCompanies,
      total: radarCompanies.length,
      summary: null,
      sectorSummary: [],
    },
    { realtime: true }
  );

  const rooms = useMemo(() => {
    const active = live.data.companies.filter((c) => c.ourProcessStage);
    return rankDealRooms(active.map((c) => buildDealRoom(toInput(c))));
  }, [live.data.companies]);

  const [filter, setFilter] = useState<Filter>("all");

  const counts = useMemo(() => {
    const now = rooms.filter((r) => r.attention === "now").length;
    const soon = rooms.filter((r) => r.attention === "soon").length;
    return { all: rooms.length, now, soon };
  }, [rooms]);

  const shown = useMemo(() => {
    if (filter === "all") return rooms;
    return rooms.filter((r) => r.attention === filter);
  }, [rooms, filter]);

  const FILTERS: { id: Filter; label: string; count: number }[] = [
    { id: "all", label: "All deals", count: counts.all },
    { id: "now", label: "Needs action", count: counts.now },
    { id: "soon", label: "Action soon", count: counts.soon },
  ];

  return (
    <div>
      {/* header */}
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <span className="text-[12px] font-normal text-subtle">
            Arbor <span className="px-1">›</span>{" "}
            <span className="text-muted">Deal Rooms</span>
          </span>
          <h1 className="mt-1 text-[20px] font-medium leading-tight text-ink">
            Deal Rooms
          </h1>
          <p className="mt-1 max-w-2xl text-[13px] font-normal text-muted">
            One focused workspace per active deal — signal, process, relationship and
            intelligence in a single view, ranked by what needs your attention.
          </p>
        </div>
        {live.loading && (
          <span className="inline-flex items-center gap-1 text-[11px] text-[#185FA5]">
            <span
              className="h-1.5 w-1.5 animate-pulse rounded-full"
              style={{ backgroundColor: "#185FA5" }}
            />
            loading live data…
          </span>
        )}
      </div>

      {/* filter segmented control */}
      <div
        className="mb-5 inline-flex rounded-md p-0.5"
        style={{ border: "0.5px solid var(--border)" }}
      >
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            aria-pressed={filter === f.id}
            className={cn(
              "rounded px-3 py-1.5 text-[12px] font-medium transition-colors",
              filter === f.id ? "text-[#0C447C]" : "text-muted hover:text-ink"
            )}
            style={filter === f.id ? { backgroundColor: "#E6F1FB" } : undefined}
          >
            {f.label}
            <span
              className={cn(
                "ml-1.5 rounded-full px-1.5 py-0.5 text-[10px]",
                filter === f.id
                  ? "bg-white text-[#0C447C]"
                  : "bg-[#F1EFE8] text-[#444441]"
              )}
            >
              {f.count}
            </span>
          </button>
        ))}
      </div>

      {/* grid */}
      {shown.length === 0 ? (
        <div
          className="rounded-lg bg-surface py-16 text-center"
          style={{ border: "0.5px solid var(--border)" }}
        >
          <p className="text-[14px] font-medium text-ink">No deal rooms here yet</p>
          <p className="mt-1 text-[13px] text-muted">
            {rooms.length === 0
              ? "Open a company and set your team's process stage to start a deal room."
              : "No deals match this filter."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((room) => (
            <DealRoomCard key={room.companyId} room={room} />
          ))}
        </div>
      )}
    </div>
  );
}
