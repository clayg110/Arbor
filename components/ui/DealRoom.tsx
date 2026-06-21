import Link from "next/link";
import { ConvictionBadge } from "./ConvictionBadge";
import { MarketTimingBadge } from "./MarketTimingBadge";
import { DealTypeBadge } from "./DealTypeBadge";
import { SectorBadge } from "./SectorBadge";
import { ChevronRightIcon } from "./icons";
import {
  ATTENTION_COLOR,
  ATTENTION_LABEL,
  type DealRoom,
  type DealRoomNextAction,
  type AttentionLevel,
} from "@/lib/deal-room";
import { PROCESS_STAGE_COLORS, PROCESS_STAGE_LABELS } from "@/lib/process-stage";

// Soft tinted backgrounds for the attention pill — paired with the AA-dark text
// token so the label always clears WCAG contrast.
const ATTENTION_BG: Record<AttentionLevel, string> = {
  now: "#FBECEB",
  soon: "#FAEEDA",
  steady: "#F1EFE8",
};
const ATTENTION_TEXT: Record<AttentionLevel, string> = {
  now: "#9A2622",
  soon: "#633806",
  steady: "#555550",
};

export function AttentionPill({ level }: { level: AttentionLevel }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium"
      style={{ backgroundColor: ATTENTION_BG[level], color: ATTENTION_TEXT[level] }}
    >
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: ATTENTION_COLOR[level] }}
        aria-hidden
      />
      {ATTENTION_LABEL[level]}
    </span>
  );
}

export function ProcessStageBadge({
  stage,
}: {
  stage: keyof typeof PROCESS_STAGE_LABELS;
}) {
  const c = PROCESS_STAGE_COLORS[stage];
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium"
      style={{ backgroundColor: c.bg, color: c.text, border: `0.5px solid ${c.border}` }}
    >
      {PROCESS_STAGE_LABELS[stage]}
    </span>
  );
}

// Human label for a next action's timing, e.g. "10d overdue" / "Due in 5d".
export function nextActionTiming(na: DealRoomNextAction): string {
  if (na.daysUntil == null) return "No date set";
  if (na.overdue) return `${Math.abs(na.daysUntil)}d overdue`;
  if (na.daysUntil === 0) return "Due today";
  if (na.daysUntil === 1) return "Due tomorrow";
  return `Due in ${na.daysUntil}d`;
}

export function NextAction({ nextAction }: { nextAction: DealRoomNextAction }) {
  const color = nextAction.overdue ? "#9A2622" : "var(--text-muted)";
  return (
    <span className="text-[11px] font-normal text-ink">
      {nextAction.label}
      <span className="ml-1.5 font-medium" style={{ color }}>
        · {nextActionTiming(nextAction)}
      </span>
    </span>
  );
}

export function DealRoomCard({ room }: { room: DealRoom }) {
  return (
    <Link
      href={`/deals/${room.companyId}`}
      className="group relative block rounded-lg bg-surface p-4 transition-colors hover:bg-[#FBFAF7]"
      style={{ border: "0.5px solid var(--border)" }}
    >
      <div className="flex items-start justify-between gap-2">
        <AttentionPill level={room.attention} />
        {room.conviction && (
          <ConvictionBadge
            score={room.conviction.score}
            band={room.conviction.band}
            showLabel
          />
        )}
      </div>

      <h3 className="mt-2.5 text-[15px] font-medium leading-snug text-ink">
        {room.name}
      </h3>
      <p className="mt-0.5 text-[11px] font-normal text-muted">
        {room.dealType === "carveout" ? "Parent" : "Sponsor"}: {room.ownerName}
      </p>

      <div className="mt-2 flex flex-wrap items-center gap-1">
        <DealTypeBadge type={room.dealType} />
        <SectorBadge sector={room.sector} />
        {room.processStage && <ProcessStageBadge stage={room.processStage} />}
      </div>

      {/* process progress */}
      <div className="mt-3">
        <div className="h-1 w-full overflow-hidden rounded-full bg-[#E6E4DD]">
          <span
            className="block h-full rounded-full"
            style={{
              width: `${Math.round(room.processProgress * 100)}%`,
              backgroundColor: "#185FA5",
            }}
          />
        </div>
      </div>

      <div className="mt-3 border-t pt-2.5" style={{ borderColor: "var(--border)" }}>
        {room.nextAction ? (
          <NextAction nextAction={room.nextAction} />
        ) : (
          <span className="text-[11px] font-normal text-subtle">
            {room.isTerminal ? "Process closed" : "No scheduled action"}
          </span>
        )}
        {room.marketTiming &&
          (room.marketStage === "monitor_for_exit" || room.marketStage === "on_hold") && (
            <div className="mt-1.5">
              <MarketTimingBadge timing={room.marketTiming} />
            </div>
          )}
        {room.stale && (
          <p className="mt-1.5 text-[11px] font-normal" style={{ color: "#633806" }}>
            No signal in 30+ days — review
          </p>
        )}
      </div>

      <span
        className="absolute bottom-3 right-3 opacity-0 transition-opacity group-hover:opacity-100"
        aria-hidden
      >
        <ChevronRightIcon className="h-4 w-4 text-[#185FA5]" />
      </span>
    </Link>
  );
}
