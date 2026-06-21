// Per-stage task playbook. Each internal process stage (lib/process-stage.ts)
// maps to the standard things a deal team does next, with a due-date offset.
// Pure + tested so the playbook is auditable; the tasks UI turns a stage's
// checklist into concrete dated tasks (skipping ones that already exist).

import type { OurProcessStage } from "@/lib/process-stage";

export interface ChecklistItem {
  title: string;
  dueOffsetDays: number; // days from the anchor date the task is due
}

export const STAGE_CHECKLISTS: Partial<Record<OurProcessStage, ChecklistItem[]>> = {
  watching: [
    { title: "Confirm sponsor/owner and hold period", dueOffsetDays: 3 },
    { title: "Add key advisor contacts", dueOffsetDays: 5 },
    { title: "Set a signal alert for this company", dueOffsetDays: 2 },
  ],
  teaser_received: [
    { title: "Review teaser and log key financials", dueOffsetDays: 2 },
    { title: "Decide go / no-go on signing the NDA", dueOffsetDays: 5 },
  ],
  nda_signed: [
    { title: "Request the CIM", dueOffsetDays: 2 },
    { title: "Set up data-room access", dueOffsetDays: 3 },
    { title: "Kick off the preliminary model", dueOffsetDays: 7 },
  ],
  cim_received: [
    { title: "Build preliminary valuation model", dueOffsetDays: 7 },
    { title: "Draft the first-round indication of interest", dueOffsetDays: 10 },
    { title: "Identify diligence workstreams", dueOffsetDays: 5 },
  ],
  first_round_bid: [
    { title: "Submit first-round indicative bid", dueOffsetDays: 1 },
    { title: "Prepare management-presentation questions", dueOffsetDays: 7 },
  ],
  management_presentation: [
    { title: "Hold the management presentation", dueOffsetDays: 3 },
    { title: "Send follow-up diligence requests", dueOffsetDays: 5 },
  ],
  second_round_bid: [
    { title: "Finalize valuation and bid range", dueOffsetDays: 3 },
    { title: "Submit second-round bid", dueOffsetDays: 5 },
  ],
  exclusivity: [
    { title: "Confirm exclusivity terms and timeline", dueOffsetDays: 2 },
    { title: "Launch confirmatory diligence", dueOffsetDays: 3 },
  ],
  loi_signed: [
    { title: "Engage legal on SPA drafting", dueOffsetDays: 3 },
    { title: "Finalize financing", dueOffsetDays: 14 },
  ],
  due_diligence: [
    { title: "Complete commercial diligence", dueOffsetDays: 14 },
    { title: "Complete financial / QoE diligence", dueOffsetDays: 14 },
    { title: "Complete legal diligence", dueOffsetDays: 14 },
  ],
};

export function checklistForStage(stage: OurProcessStage): ChecklistItem[] {
  return STAGE_CHECKLISTS[stage] ?? [];
}

export function hasChecklist(stage: OurProcessStage): boolean {
  return (STAGE_CHECKLISTS[stage]?.length ?? 0) > 0;
}

// Stages that ship a playbook, in pipeline order.
export function stagesWithChecklist(): OurProcessStage[] {
  return (Object.keys(STAGE_CHECKLISTS) as OurProcessStage[]).filter(hasChecklist);
}

function addDays(anchorISO: string, days: number): string {
  const d = new Date(anchorISO);
  if (Number.isNaN(d.getTime())) return anchorISO;
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

export interface SuggestedTask {
  title: string;
  dueAt: string; // YYYY-MM-DD
}

// Concrete dated tasks for a stage, dropping any whose title already exists
// (case-insensitive) so re-running a checklist never duplicates work.
export function suggestedTasks(
  stage: OurProcessStage,
  anchorISO: string,
  existingTitles: string[] = []
): SuggestedTask[] {
  const have = new Set(existingTitles.map((t) => t.trim().toLowerCase()));
  return checklistForStage(stage)
    .filter((i) => !have.has(i.title.toLowerCase()))
    .map((i) => ({ title: i.title, dueAt: addDays(anchorISO, i.dueOffsetDays) }));
}
