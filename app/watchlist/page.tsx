"use client";

import { useState } from "react";
import Link from "next/link";
import { RadarCompanyCard } from "@/components/ui/RadarCompanyCard";
import { StarIcon } from "@/components/ui/icons";
import { radarCompanies, type RadarCompany } from "@/lib/radar-data";
import { useLive } from "@/lib/use-live";
import { api, BackendOff } from "@/lib/api-client";

const MOCK_WATCHED: RadarCompany[] = radarCompanies.filter((c) => c.watchlisted);

export default function WatchlistPage() {
  // Mock fallback only used when there's no backend (source stays "mock").
  const live = useLive("watchlist", () => api.watchlist(), {
    ids: MOCK_WATCHED.map((c) => c.id),
    companies: MOCK_WATCHED,
  });

  // Optimistic removals layered over live data (no separate copy of the list,
  // so we never flash stale/mock data before the fetch resolves).
  const [removed, setRemoved] = useState<Set<string>>(new Set());
  const list = live.data.companies.filter((c) => !removed.has(c.id));

  function remove(id: string) {
    setRemoved((prev) => new Set(prev).add(id));
    if (live.source === "live") {
      api.removeWatch(id).catch((e) => {
        if (!(e instanceof BackendOff)) {
          setRemoved((prev) => {
            const n = new Set(prev);
            n.delete(id);
            return n;
          });
        }
      });
    }
  }

  return (
    <div>
      <div className="mb-1 flex items-center gap-2">
        <StarIcon filled className="h-[18px] w-[18px]" style={{ color: "#BA7517" }} />
        <h1 className="text-[18px] font-medium text-ink">Watchlist</h1>
        {!live.loading && (
          <span className="rounded-full bg-[#F1EFE8] px-2 py-0.5 text-[11px] font-medium text-[#444441]">
            {list.length}
          </span>
        )}
      </div>
      <p className="mb-5 text-[13px] font-normal text-muted">
        Companies you&apos;re tracking. Removing here unstars them everywhere.
      </p>

      {live.loading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-28 animate-pulse rounded-lg bg-[#EFEDE6]" />
          ))}
        </div>
      ) : list.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <StarIcon className="h-12 w-12 text-subtle" />
          <p className="mt-4 text-[14px] font-medium text-ink">
            Nothing on your watchlist yet
          </p>
          <p className="mt-1 text-[13px] font-normal text-muted">
            Star companies from the radar or feed to track them here.
          </p>
          <Link
            href="/radar"
            className="mt-4 rounded-md px-3 py-1.5 text-[12px] font-medium text-white"
            style={{ backgroundColor: "#185FA5" }}
          >
            Go to radar
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((c) => (
            <RadarCompanyCard
              key={c.id}
              c={c}
              watched
              onToggleWatch={() => remove(c.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
