// Pure aggregation for Deal Rooms: a focused per-deal cockpit that unifies the
// four Arbor layers (signal · process · relationship · intelligence) into a
// single "what needs attention on this deal right now" model. The company
// profile is the full editable record; a deal room is the prioritized command
// view over the deals our team is actively running. No I/O — the page maps its
// row shape onto DealRoomInput and renders the result.

import type { DealType, Sector, Stage } from "@/lib/types";
import {
  PROCESS_STAGE_LABELS,
  PROCESS_STAGES,
  isTerminalStage,
  processStageIndex,
  type OurProcessStage,
  type ProcessKeyDates,
} from "@/lib/process-stage";
import type { Conviction } from "@/lib/conviction";
import type { MarketTiming } from "@/lib/predict-market";

export type AttentionLevel = "now" | "soon" | "steady";

export interface DealRoomInput {
  companyId: string;
  name: string;
  dealType: DealType;
  sector: Sector;
  ownerName: string;
  marketStage: Stage;
  processStage: OurProcessStage | null;
  keyDates: ProcessKeyDates | null;
  conviction?: Conviction;
  marketTiming?: MarketTiming;
  lastSignalDaysAgo: number;
  openTaskCount?: number;
  overdueTaskCount?: number;
}

export interface DealRoomDate {
  stage: OurProcessStage;
  label: string;
  date: string; // ISO
  daysUntil: number; // negative = past
}

export interface DealRoomNextAction {
  label: string;
  date: string | null;
  daysUntil: number | null; // negative = overdue
  overdue: boolean;
}

export interface DealRoom {
  companyId: string;
  name: string;
  dealType: DealType;
  sector: Sector;
  ownerName: string;
  marketStage: Stage;
  processStage: OurProcessStage | null;
  processStageLabel: string | null;
  processProgress: number; // 0..1 along the active pipeline
  conviction?: Conviction;
  marketTiming?: MarketTiming;
  keyDates: DealRoomDate[]; // sorted ascending by date
  nextAction: DealRoomNextAction | null;
  attention: AttentionLevel;
  attentionScore: number;
  stale: boolean;
  isTerminal: boolean;
}

const STALE_DAYS = 30;
// The active (non-terminal) pipeline used for the progress bar.
const ACTIVE_STAGE_COUNT = PROCESS_STAGES.filter((s) => !isTerminalStage(s)).length;

// Whole-day difference between an ISO date and `now`, counted at day granularity
// so "today" is 0 regardless of clock time. Returns null for an unparseable date.
function dayDiff(iso: string, now: Date): number | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const target = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((target - today) / 86_400_000);
}

export function parseKeyDates(
  keyDates: ProcessKeyDates | null,
  now = new Date()
): DealRoomDate[] {
  if (!keyDates) return [];
  const out: DealRoomDate[] = [];
  for (const [stage, date] of Object.entries(keyDates)) {
    if (!date) continue;
    const daysUntil = dayDiff(date, now);
    if (daysUntil === null) continue;
    out.push({
      stage: stage as OurProcessStage,
      label: PROCESS_STAGE_LABELS[stage as OurProcessStage] ?? stage,
      date,
      daysUntil,
    });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

// The single most pressing thing to do, in priority order:
//   1. an overdue milestone planned for the current-or-later stage,
//   2. the soonest upcoming key date,
//   3. otherwise just "advance from the current stage".
function nextActionFrom(
  dates: DealRoomDate[],
  processStage: OurProcessStage | null,
  isTerminal: boolean
): DealRoomNextAction | null {
  if (isTerminal) return null;
  const currentIdx = processStage ? processStageIndex(processStage) : -1;

  const overdue = dates
    .filter((d) => d.daysUntil < 0 && processStageIndex(d.stage) >= currentIdx)
    .sort((a, b) => a.daysUntil - b.daysUntil); // most overdue first
  if (overdue[0]) {
    const d = overdue[0];
    return {
      label: `${d.label} overdue`,
      date: d.date,
      daysUntil: d.daysUntil,
      overdue: true,
    };
  }

  const upcoming = dates.find((d) => d.daysUntil >= 0);
  if (upcoming) {
    return {
      label: `${upcoming.label} due`,
      date: upcoming.date,
      daysUntil: upcoming.daysUntil,
      overdue: false,
    };
  }

  if (processStage) {
    return {
      label: `Advance from ${PROCESS_STAGE_LABELS[processStage]}`,
      date: null,
      daysUntil: null,
      overdue: false,
    };
  }
  return null;
}

function attentionScore(
  i: DealRoomInput,
  nextAction: DealRoomNextAction | null,
  isTerminal: boolean,
  stale: boolean
): number {
  if (isTerminal) return 0;
  let score = 0;

  score += (i.overdueTaskCount ?? 0) * 25;
  score += (i.openTaskCount ?? 0) * 4;

  if (nextAction?.overdue) {
    score += 40;
  } else if (nextAction?.daysUntil != null) {
    const d = nextAction.daysUntil;
    if (d <= 3) score += 30;
    else if (d <= 7) score += 22;
    else if (d <= 14) score += 12;
    else if (d <= 30) score += 5;
  }

  if (i.conviction?.band === "hot") score += 12;
  else if (i.conviction?.band === "warm") score += 5;

  if (i.marketTiming?.band === "imminent") score += 10;
  else if (i.marketTiming?.band === "emerging") score += 4;

  if (stale) score += 8;

  return score;
}

function attentionLevel(score: number): AttentionLevel {
  if (score >= 30) return "now";
  if (score >= 12) return "soon";
  return "steady";
}

function processProgress(
  processStage: OurProcessStage | null,
  isTerminal: boolean
): number {
  if (isTerminal) return 1;
  if (!processStage) return 0;
  const idx = processStageIndex(processStage);
  if (idx < 0) return 0;
  return Math.min(1, idx / (ACTIVE_STAGE_COUNT - 1));
}

export function buildDealRoom(i: DealRoomInput, now = new Date()): DealRoom {
  const isTerminal = i.processStage ? isTerminalStage(i.processStage) : false;
  const keyDates = parseKeyDates(i.keyDates, now);
  const nextAction = nextActionFrom(keyDates, i.processStage, isTerminal);
  const stale = !isTerminal && i.lastSignalDaysAgo > STALE_DAYS;
  const score = attentionScore(i, nextAction, isTerminal, stale);

  return {
    companyId: i.companyId,
    name: i.name,
    dealType: i.dealType,
    sector: i.sector,
    ownerName: i.ownerName,
    marketStage: i.marketStage,
    processStage: i.processStage,
    processStageLabel: i.processStage ? PROCESS_STAGE_LABELS[i.processStage] : null,
    processProgress: processProgress(i.processStage, isTerminal),
    conviction: i.conviction,
    marketTiming: i.marketTiming,
    keyDates,
    nextAction,
    attention: attentionLevel(score),
    attentionScore: score,
    stale,
    isTerminal,
  };
}

// Rank deal rooms so the ones needing action surface first: highest attention,
// then soonest next action, then alphabetical for a stable order.
export function rankDealRooms(rooms: DealRoom[]): DealRoom[] {
  return [...rooms].sort((a, b) => {
    if (b.attentionScore !== a.attentionScore) {
      return b.attentionScore - a.attentionScore;
    }
    const ad = a.nextAction?.daysUntil ?? Number.POSITIVE_INFINITY;
    const bd = b.nextAction?.daysUntil ?? Number.POSITIVE_INFINITY;
    if (ad !== bd) return ad - bd;
    return a.name.localeCompare(b.name);
  });
}

export const ATTENTION_LABEL: Record<AttentionLevel, string> = {
  now: "Needs action",
  soon: "Action soon",
  steady: "Steady",
};

// AA-contrast dot/accent colors (decorative — never carry text contrast alone).
export const ATTENTION_COLOR: Record<AttentionLevel, string> = {
  now: "#C0322F",
  soon: "#8A5712",
  steady: "#5f5e57",
};
