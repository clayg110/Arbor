// Pure helpers for the internal deal process stage tracker. No I/O.

export type OurProcessStage =
  | "watching"
  | "teaser_received"
  | "nda_signed"
  | "cim_received"
  | "first_round_bid"
  | "management_presentation"
  | "second_round_bid"
  | "exclusivity"
  | "loi_signed"
  | "due_diligence"
  | "won"
  | "passed";

export const PROCESS_STAGES: OurProcessStage[] = [
  "watching",
  "teaser_received",
  "nda_signed",
  "cim_received",
  "first_round_bid",
  "management_presentation",
  "second_round_bid",
  "exclusivity",
  "loi_signed",
  "due_diligence",
  "won",
  "passed",
];

export const PROCESS_STAGE_LABELS: Record<OurProcessStage, string> = {
  watching: "Watching",
  teaser_received: "Teaser received",
  nda_signed: "NDA signed",
  cim_received: "CIM received",
  first_round_bid: "First round bid",
  management_presentation: "Mgmt presentation",
  second_round_bid: "Second round bid",
  exclusivity: "Exclusivity",
  loi_signed: "LOI signed",
  due_diligence: "Due diligence",
  won: "Won",
  passed: "Passed",
};

export const PROCESS_STAGE_SHORT: Record<OurProcessStage, string> = {
  watching: "Watching",
  teaser_received: "Teaser",
  nda_signed: "NDA",
  cim_received: "CIM",
  first_round_bid: "1st Bid",
  management_presentation: "Mgmt Pres.",
  second_round_bid: "2nd Bid",
  exclusivity: "Exclusivity",
  loi_signed: "LOI",
  due_diligence: "Due Diligence",
  won: "Won",
  passed: "Passed",
};

export type ProcessStageColor = { bg: string; text: string; border: string };

export const PROCESS_STAGE_COLORS: Record<OurProcessStage, ProcessStageColor> = {
  watching: { bg: "#f1f5f9", text: "#475569", border: "#cbd5e1" },
  teaser_received: { bg: "#eff6ff", text: "#1d4ed8", border: "#bfdbfe" },
  nda_signed: { bg: "#f0fdf4", text: "#15803d", border: "#bbf7d0" },
  cim_received: { bg: "#dcfce7", text: "#166534", border: "#86efac" },
  first_round_bid: { bg: "#fefce8", text: "#854d0e", border: "#fde68a" },
  management_presentation: { bg: "#fff7ed", text: "#9a3412", border: "#fed7aa" },
  second_round_bid: { bg: "#fef3c7", text: "#92400e", border: "#fcd34d" },
  exclusivity: { bg: "#fdf4ff", text: "#7e22ce", border: "#e9d5ff" },
  loi_signed: { bg: "#f5f3ff", text: "#6d28d9", border: "#ddd6fe" },
  due_diligence: { bg: "#f0f9ff", text: "#0369a1", border: "#bae6fd" },
  won: { bg: "#f0fdf4", text: "#157A5A", border: "#bbf7d0" },
  passed: { bg: "#fef2f2", text: "#C0322F", border: "#fecaca" },
};

export interface ProcessHistoryEntry {
  id: string;
  companyId: string;
  userId: string;
  stage: OurProcessStage;
  notes: string | null;
  changedAt: string;
  authorName: string;
}

export type ProcessKeyDates = Partial<Record<OurProcessStage, string>>;

export function processStageIndex(stage: OurProcessStage): number {
  return PROCESS_STAGES.indexOf(stage);
}

export function isTerminalStage(stage: OurProcessStage): boolean {
  return stage === "won" || stage === "passed";
}

// Returns active (non-terminal) stages only.
export function isActiveStage(stage: OurProcessStage): boolean {
  return !isTerminalStage(stage);
}

// Summary text for the process strip: "3 NDAs · 2 first-round bids · 1 in exclusivity"
export function processStripSummary(
  stageCounts: Partial<Record<OurProcessStage, number>>
): string {
  const active: OurProcessStage[] = [
    "watching",
    "teaser_received",
    "nda_signed",
    "cim_received",
    "first_round_bid",
    "management_presentation",
    "second_round_bid",
    "exclusivity",
    "loi_signed",
    "due_diligence",
  ];
  const parts: string[] = [];
  for (const s of active) {
    const n = stageCounts[s];
    if (n) parts.push(`${n} ${PROCESS_STAGE_LABELS[s]}`);
  }
  const won = stageCounts["won"];
  const passed = stageCounts["passed"];
  if (won) parts.push(`${won} Won`);
  if (passed) parts.push(`${passed} Passed`);
  return parts.join(" · ") || "No active processes";
}
