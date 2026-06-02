"use client";

import { useState } from "react";
import { StarIcon } from "./icons";
import { mockWatchlist } from "@/lib/mock-data";
import { cn } from "@/lib/format";

export function WatchlistButton({
  companyId,
  withLabel = false,
}: {
  companyId: string;
  withLabel?: boolean;
}) {
  const [watched, setWatched] = useState(mockWatchlist.includes(companyId));

  return (
    <button
      type="button"
      onClick={() => setWatched((w) => !w)}
      aria-pressed={watched}
      aria-label={watched ? "Remove from watchlist" : "Add to watchlist"}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[12px] font-medium transition-colors",
        withLabel ? "" : "px-1.5",
        watched ? "text-ink" : "text-muted hover:text-ink"
      )}
      style={withLabel ? { border: "0.5px solid var(--border)" } : undefined}
    >
      <StarIcon
        filled={watched}
        className="h-4 w-4"
        style={{ color: watched ? "#BA7517" : undefined }}
      />
      {withLabel && (watched ? "Watching" : "Watch")}
    </button>
  );
}
