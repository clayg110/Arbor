"use client";

import { SECTOR_LABELS, SECTORS, STAGE_COLORS } from "@/lib/colors";
import type { Sector } from "@/lib/types";

export type SectorFilter = Sector | "all";

export function SectorFilterBar({
  active,
  onChange,
}: {
  active: SectorFilter;
  onChange: (s: SectorFilter) => void;
}) {
  const blue = STAGE_COLORS.in_market;
  const items: SectorFilter[] = ["all", ...SECTORS];

  return (
    <div className="flex gap-1.5 overflow-x-auto pb-1">
      {items.map((s) => {
        const isActive = active === s;
        return (
          <button
            key={s}
            type="button"
            onClick={() => onChange(s)}
            className="whitespace-nowrap rounded-full px-3 py-1 text-[12px] font-medium transition-colors"
            style={
              isActive
                ? {
                    backgroundColor: blue.bg,
                    color: blue.text,
                    boxShadow: `inset 0 0 0 0.5px ${blue.border}`,
                  }
                : {
                    backgroundColor: "var(--surface)",
                    color: "var(--text-muted)",
                    boxShadow: "inset 0 0 0 0.5px var(--border)",
                  }
            }
          >
            {s === "all" ? "All sectors" : SECTOR_LABELS[s]}
          </button>
        );
      })}
    </div>
  );
}
