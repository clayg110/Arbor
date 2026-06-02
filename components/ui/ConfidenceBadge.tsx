import { Pill } from "./Pill";
import { CONFIDENCE_COLORS, CONFIDENCE_LABELS } from "@/lib/colors";
import type { Confidence } from "@/lib/types";

export function ConfidenceBadge({ confidence }: { confidence: Confidence }) {
  const c = CONFIDENCE_COLORS[confidence];
  const pulse = confidence === "needs_review";
  return (
    <Pill bg={c.bg} text={c.text}>
      {pulse && (
        <span className="relative flex h-1.5 w-1.5">
          <span
            className="absolute inline-flex h-full w-full rounded-full animate-ping-dot"
            style={{ backgroundColor: "#E24B4A" }}
          />
          <span
            className="relative inline-flex h-1.5 w-1.5 rounded-full"
            style={{ backgroundColor: "#E24B4A" }}
          />
        </span>
      )}
      {CONFIDENCE_LABELS[confidence]}
    </Pill>
  );
}
