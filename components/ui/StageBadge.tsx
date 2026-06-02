import { Pill } from "./Pill";
import { STAGE_COLORS, STAGE_LABELS } from "@/lib/colors";
import type { Stage } from "@/lib/types";

export function StageBadge({ stage }: { stage: Stage }) {
  const c = STAGE_COLORS[stage];
  return (
    <Pill bg={c.bg} text={c.text} border={c.border}>
      {STAGE_LABELS[stage]}
    </Pill>
  );
}
