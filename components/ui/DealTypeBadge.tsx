import { Pill } from "./Pill";
import { DEAL_TYPE_COLORS, DEAL_TYPE_LABELS } from "@/lib/colors";
import type { DealType } from "@/lib/types";

export function DealTypeBadge({ type }: { type: DealType }) {
  const c = DEAL_TYPE_COLORS[type];
  return (
    <Pill bg={c.bg} text={c.text}>
      {DEAL_TYPE_LABELS[type]}
    </Pill>
  );
}
