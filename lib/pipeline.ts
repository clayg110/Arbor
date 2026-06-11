// Pure helpers for the pipeline-level partner dashboard. No I/O.

import {
  PROCESS_STAGES,
  PROCESS_STAGE_LABELS,
  isTerminalStage,
  type OurProcessStage,
  type ProcessKeyDates,
} from "./process-stage";

export interface PipelineDeal {
  companyId: string;
  companyName: string;
  sector: string;
  dealType: string;
  ourProcessStage: OurProcessStage;
  keyDates: ProcessKeyDates;
  daysInStage: number;
  ownerId: string | null;
  ownerEmail: string | null;
  bidCount: number;
  avgBidMultiple: number | null;
}

export interface FunnelSlice {
  stage: OurProcessStage;
  label: string;
  count: number;
}

export interface OwnerWorkloadEntry {
  ownerId: string | null;
  ownerEmail: string | null;
  count: number;
}

export interface SectorCount {
  sector: string;
  count: number;
}

export interface UpcomingDate {
  companyId: string;
  companyName: string;
  stage: OurProcessStage;
  stageLabel: string;
  date: string;
  daysUntil: number;
}

// Active (non-terminal) process stage counts in stage order.
export function pipelineFunnel(deals: PipelineDeal[]): FunnelSlice[] {
  const active = PROCESS_STAGES.filter((s) => !isTerminalStage(s));
  const counts = new Map<OurProcessStage, number>();
  for (const d of deals) {
    if (!isTerminalStage(d.ourProcessStage)) {
      counts.set(d.ourProcessStage, (counts.get(d.ourProcessStage) ?? 0) + 1);
    }
  }
  return active
    .filter((s) => (counts.get(s) ?? 0) > 0)
    .map((stage) => ({
      stage,
      label: PROCESS_STAGE_LABELS[stage],
      count: counts.get(stage)!,
    }));
}

export function ownerWorkload(deals: PipelineDeal[]): OwnerWorkloadEntry[] {
  const map = new Map<string | null, { email: string | null; count: number }>();
  for (const d of deals) {
    const existing = map.get(d.ownerId) ?? { email: d.ownerEmail, count: 0 };
    existing.count += 1;
    map.set(d.ownerId, existing);
  }
  return [...map.entries()]
    .map(([ownerId, { email, count }]) => ({ ownerId, ownerEmail: email, count }))
    .sort((a, b) => b.count - a.count);
}

export function sectorConcentration(deals: PipelineDeal[]): SectorCount[] {
  const map = new Map<string, number>();
  for (const d of deals) {
    map.set(d.sector, (map.get(d.sector) ?? 0) + 1);
  }
  return [...map.entries()]
    .map(([sector, count]) => ({ sector, count }))
    .sort((a, b) => b.count - a.count);
}

// Key dates that fall within `days` calendar days from `today` (ISO date string).
export function upcomingKeyDates(
  deals: PipelineDeal[],
  today: string,
  days = 14
): UpcomingDate[] {
  const todayMs = new Date(today + "T00:00:00").getTime();
  const cutoffMs = todayMs + days * 86_400_000;
  const result: UpcomingDate[] = [];
  for (const d of deals) {
    for (const [stage, date] of Object.entries(d.keyDates)) {
      if (!date) continue;
      const ms = new Date(date + "T00:00:00").getTime();
      if (ms >= todayMs && ms <= cutoffMs) {
        result.push({
          companyId: d.companyId,
          companyName: d.companyName,
          stage: stage as OurProcessStage,
          stageLabel: PROCESS_STAGE_LABELS[stage as OurProcessStage],
          date,
          daysUntil: Math.round((ms - todayMs) / 86_400_000),
        });
      }
    }
  }
  return result.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

// Deals that haven't progressed in more than `thresholdDays` days.
export function staleDeals(deals: PipelineDeal[], thresholdDays = 30): PipelineDeal[] {
  return deals.filter(
    (d) => !isTerminalStage(d.ourProcessStage) && d.daysInStage > thresholdDays
  );
}
