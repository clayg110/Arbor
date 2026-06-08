"use client";

import { useState } from "react";
import Link from "next/link";
import { StageBadge } from "./StageBadge";
import { DealTypeBadge } from "./DealTypeBadge";
import { StageOverrideModal } from "./StageOverrideModal";
import { STAGE_LABELS } from "@/lib/colors";
import type { Company, Stage } from "@/lib/types";

export function ReviewRow({
  company,
  conflictSummary,
  reason,
  onAction,
}: {
  company: Company;
  conflictSummary: string;
  reason: string;
  onAction?: (action: "confirm" | "override", stage?: Stage) => void;
}) {
  const [open, setOpen] = useState(false);
  const [resolved, setResolved] = useState<null | string>(null);

  if (resolved) {
    return (
      <div
        className="rounded-lg bg-surface px-4 py-3 text-[13px] font-normal text-muted"
        style={{ border: "0.5px solid var(--border)", borderLeft: "2px solid #27500A" }}
      >
        <span className="font-medium text-ink">{company.name}</span> — {resolved}
      </div>
    );
  }

  return (
    <div
      className="rounded-lg bg-surface"
      style={{ border: "0.5px solid var(--border)", borderLeft: "2px solid #BA7517" }}
    >
      <div className="flex flex-wrap items-start gap-3 px-4 py-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/company/${company.id}`}
              className="text-[13px] font-medium text-ink hover:underline"
            >
              {company.name}
            </Link>
            <StageBadge stage={company.currentStage} />
            <DealTypeBadge type={company.dealType} />
            <span className="rounded bg-[#FAEEDA] px-1.5 py-0.5 text-[10px] font-medium text-[#633806]">
              {reason}
            </span>
          </div>
          <p className="mt-1 text-[12px] font-normal text-muted">{conflictSummary}</p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => {
              onAction?.("confirm");
              setResolved(`stage confirmed as ${STAGE_LABELS[company.currentStage]}`);
            }}
            className="rounded-md px-3 py-1.5 text-[12px] font-medium"
            style={{ backgroundColor: "#EAF3DE", color: "#27500A" }}
          >
            Confirm
          </button>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="rounded-md px-3 py-1.5 text-[12px] font-medium text-ink"
            style={{ border: "0.5px solid var(--border)" }}
          >
            Override
          </button>
        </div>
      </div>

      {open && (
        <div className="px-4 pb-4">
          <StageOverrideModal
            companyName={company.name}
            currentStage={company.currentStage}
            onCancel={() => setOpen(false)}
            onConfirm={(stage: Stage) => {
              setOpen(false);
              onAction?.("override", stage);
              setResolved(`stage overridden to ${STAGE_LABELS[stage]}`);
            }}
          />
        </div>
      )}
    </div>
  );
}
