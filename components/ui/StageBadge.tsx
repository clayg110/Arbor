import { Pill } from "./Pill";
import { STAGE_COLORS, STAGE_LABELS } from "@/lib/colors";
import type { Stage } from "@/lib/types";

export function StageBadge({ stage }: { stage: Stage | null | undefined }) {
  // Defensive: live data can carry a null/unknown stage (e.g. a first stage
  // change has no prior stage). Fall back instead of crashing.
  const c = (stage && STAGE_COLORS[stage]) || STAGE_COLORS.in_market;
  const label = (stage && STAGE_LABELS[stage]) || "—";
  return (
    <Pill bg={c.bg} text={c.text} border={c.border}>
      {label}
    </Pill>
  );
}
