"use client";

import { useState } from "react";
import { STAGE_COLORS, STAGE_LABELS, STAGE_DOT } from "@/lib/colors";
import type { Stage } from "@/lib/types";

const STAGES: Stage[] = ["in_market", "monitor_for_exit", "on_hold", "pulled"];

export function StageOverrideModal({
  companyName,
  currentStage,
  onConfirm,
  onCancel,
}: {
  companyName: string;
  currentStage: Stage;
  onConfirm: (stage: Stage) => void;
  onCancel: () => void;
}) {
  const [selected, setSelected] = useState<Stage>(currentStage);

  return (
    // Faux viewport (no position:fixed) — inline expansion.
    <div
      className="mt-3 rounded-lg bg-[#F5F4EF] p-4"
      style={{ border: "0.5px solid var(--border)", minHeight: 420 }}
    >
      <div className="mb-1 text-[13px] font-medium text-ink">
        Override stage — {companyName}
      </div>
      <div className="mb-4 flex items-center gap-1.5 text-[12px] font-normal text-muted">
        Current stage:
        <span
          className="inline-block h-2 w-2 rounded-full"
          style={{ backgroundColor: STAGE_DOT[currentStage] }}
        />
        {STAGE_LABELS[currentStage]}
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {STAGES.map((s) => {
          const c = STAGE_COLORS[s];
          const isSel = selected === s;
          return (
            <button
              key={s}
              type="button"
              onClick={() => setSelected(s)}
              className="flex items-center gap-2 rounded-lg bg-surface px-3 py-3 text-left text-[13px] font-medium transition-colors"
              style={{
                boxShadow: isSel
                  ? `inset 0 0 0 1.5px ${c.border ?? c.text}`
                  : "inset 0 0 0 0.5px var(--border)",
              }}
            >
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: STAGE_DOT[s] }}
              />
              <span className="text-ink">{STAGE_LABELS[s]}</span>
              {s === currentStage && (
                <span className="ml-auto text-[11px] font-normal text-subtle">
                  current
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-4 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md px-3 py-1.5 text-[12px] font-medium text-muted hover:text-ink"
          style={{ border: "0.5px solid var(--border)" }}
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => onConfirm(selected)}
          className="rounded-md px-3 py-1.5 text-[12px] font-medium text-white"
          style={{ backgroundColor: "#185FA5" }}
        >
          Confirm override
        </button>
      </div>
    </div>
  );
}
