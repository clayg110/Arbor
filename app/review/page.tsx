"use client";

import { useMemo, useState } from "react";
import { ReviewRow } from "@/components/ui/ReviewRow";
import { mockReviewItems, getCompany } from "@/lib/mock-data";
import { SECTOR_LABELS, SECTORS } from "@/lib/colors";
import { useLive } from "@/lib/use-live";
import { api } from "@/lib/api-client";
import type { ReviewRowData } from "@/lib/adapters/review";
import type { Sector, Stage } from "@/lib/types";

const MOCK_ROWS: ReviewRowData[] = mockReviewItems
  .map((i) => ({
    company: getCompany(i.companyId),
    reason: i.reason,
    conflictSummary: i.conflictSummary,
  }))
  .filter((r): r is ReviewRowData => !!r.company);

export default function ReviewPage() {
  const [sector, setSector] = useState<Sector | "all">("all");

  const live = useLive(
    "review",
    async () => ((await api.review()) as { rows: ReviewRowData[] }).rows,
    MOCK_ROWS
  );
  const allRows = live.data;

  const rows = useMemo(
    () => allRows.filter((r) => sector === "all" || r.company.sector === sector),
    [allRows, sector]
  );

  return (
    <div>
      <div className="mb-1 flex items-center gap-2">
        <h1 className="text-[18px] font-medium text-ink">Analyst review queue</h1>
        <span
          className="rounded-full px-2 py-0.5 text-[11px] font-medium"
          style={{ backgroundColor: "#FCEBEB", color: "#791F1F" }}
        >
          {allRows.length}
        </span>
      </div>

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <p className="text-[13px] font-normal text-muted">
          {rows.length} companies flagged for analyst review
        </p>
        <select
          aria-label="Filter by sector"
          value={sector}
          onChange={(e) => setSector(e.target.value as Sector | "all")}
          className="rounded-md bg-surface px-2.5 py-1.5 text-[12px] font-normal text-ink focus:outline-none"
          style={{ border: "0.5px solid var(--border)" }}
        >
          <option value="all">All sectors</option>
          {SECTORS.map((s) => (
            <option key={s} value={s}>
              {SECTOR_LABELS[s]}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2.5">
        {rows.map(({ company, reason, conflictSummary }) => (
          <ReviewRow
            key={company.id}
            company={company}
            reason={reason}
            conflictSummary={conflictSummary}
            onAction={
              live.source === "live"
                ? (action: "confirm" | "override", stage?: Stage) =>
                    api.reviewAction(company.id, { action, stage }).catch(() => {})
                : undefined
            }
          />
        ))}
        {rows.length === 0 && (
          <p className="py-12 text-center text-[13px] text-subtle">
            No companies in this sector need review.
          </p>
        )}
      </div>
    </div>
  );
}
