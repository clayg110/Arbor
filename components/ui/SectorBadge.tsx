import { Pill } from "./Pill";
import { SECTOR_SWATCH, SECTOR_LABELS } from "@/lib/colors";
import type { Sector } from "@/lib/types";

export function SectorBadge({ sector }: { sector: Sector }) {
  return (
    <Pill bg={SECTOR_SWATCH.bg} text={SECTOR_SWATCH.text}>
      {SECTOR_LABELS[sector]}
    </Pill>
  );
}
