import { StageBadge } from "./StageBadge";
import { SignalSourceBadge } from "./SignalSourceBadge";
import { STAGE_DOT } from "@/lib/colors";
import { formatDate } from "@/lib/format";
import type { StageHistoryRecord } from "@/lib/types";

export function StageTimeline({
  history,
}: {
  history: StageHistoryRecord[];
}) {
  if (history.length === 0) {
    return <p className="text-[13px] text-subtle">No stage history yet.</p>;
  }
  return (
    <ol className="relative">
      {history.map((h, i) => {
        const last = i === history.length - 1;
        return (
          <li key={h.id} className="relative flex gap-3 pb-5">
            {/* dot + connector */}
            <div className="relative flex w-3 shrink-0 flex-col items-center">
              <span
                className="mt-1 h-3 w-3 rounded-full"
                style={{
                  backgroundColor: STAGE_DOT[h.stage],
                  boxShadow: "0 0 0 3px var(--bg)",
                }}
              />
              {!last && (
                <span
                  className="absolute top-4 h-[calc(100%-0.5rem)] w-px"
                  style={{ backgroundColor: "var(--border)" }}
                />
              )}
            </div>

            {/* content */}
            <div className="min-w-0 flex-1 -mt-0.5">
              <div className="flex flex-wrap items-center gap-2">
                <StageBadge stage={h.stage} />
                <span className="text-[12px] font-normal text-muted">
                  {formatDate(h.changedAt)}
                </span>
                <span className="rounded bg-[#F1EFE8] px-1.5 py-0.5 text-[10px] font-normal text-[#444441]">
                  {h.changedBy === "analyst_manual" ? "analyst" : "system"}
                </span>
              </div>
              {h.notes && (
                <p className="mt-1 text-[12px] font-normal text-muted">
                  {h.notes}
                </p>
              )}
              <div className="mt-1 flex items-center gap-2">
                <SignalSourceBadge source={h.sourceType} />
                {h.sourceUrl && (
                  <a
                    href={h.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] font-normal text-[#185FA5] hover:underline"
                  >
                    View source
                  </a>
                )}
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
