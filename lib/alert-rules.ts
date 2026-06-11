// Custom alert rules: a small JSON predicate matched against deal events (stage
// changes / new entries) by the notify cron. Pure + unit-tested so the matching
// semantics are stable; the cron supplies events + persists the notifications.

import type { Sector, DealType, Stage, Confidence } from "@/lib/types";
import type { NotificationRow } from "@/lib/notifications";
import type { DbAlertRule } from "@/types/db";

export interface AlertPredicate {
  sector?: Sector;
  dealType?: DealType;
  sponsorContains?: string;
  nameContains?: string; // substring match on company name (case-insensitive)
  stageEnters?: Stage; // matches when the company's (new) stage equals this
  minConfidence?: Confidence;
  minConviction?: number; // 0–100
}

export interface AlertRule {
  id: string;
  userId: string;
  orgId: string | null;
  name: string;
  predicate: AlertPredicate;
  webhook: boolean;
  emailDelivery: boolean;
  active: boolean;
}

export interface AlertEvent {
  companyId: string;
  companyName: string;
  eventType: string; // "moved_in_market" | "new_entry" | ...
  stage: Stage;
  sector: Sector;
  dealType: DealType;
  sponsor: string | null;
  confidence: Confidence;
  convictionScore?: number;
  at: string; // ISO
}

const CONF_RANK: Record<Confidence, number> = {
  high: 4,
  medium: 3,
  low: 2,
  needs_review: 1,
};

// True when every defined predicate field matches the event (AND). An empty
// predicate matches everything (a catch-all alert). Inactive rules never match.
export function matchRule(
  rule: Pick<AlertRule, "predicate" | "active">,
  e: AlertEvent
): boolean {
  if (!rule.active) return false;
  const p = rule.predicate ?? {};
  if (p.sector && e.sector !== p.sector) return false;
  if (p.dealType && e.dealType !== p.dealType) return false;
  if (p.stageEnters && e.stage !== p.stageEnters) return false;
  if (p.sponsorContains) {
    const hay = (e.sponsor ?? "").toLowerCase();
    if (!hay.includes(p.sponsorContains.toLowerCase())) return false;
  }
  if (p.nameContains) {
    if (!e.companyName.toLowerCase().includes(p.nameContains.toLowerCase())) return false;
  }
  if (p.minConfidence && CONF_RANK[e.confidence] < CONF_RANK[p.minConfidence]) {
    return false;
  }
  if (p.minConviction != null && (e.convictionScore ?? 0) < p.minConviction) {
    return false;
  }
  return true;
}

export function rulesForEvent(rules: AlertRule[], e: AlertEvent): AlertRule[] {
  return rules.filter((r) => matchRule(r, e));
}

export function toAlertRule(r: DbAlertRule): AlertRule {
  return {
    id: r.id,
    userId: r.user_id,
    orgId: r.org_id,
    name: r.name,
    predicate: (r.predicate ?? {}) as AlertPredicate,
    webhook: r.webhook,
    emailDelivery: r.email_delivery ?? false,
    active: r.active,
  };
}

const EVENT_LABEL: Record<string, string> = {
  moved_in_market: "entered In market",
  moved_monitor: "moved to Monitor for exit",
  moved_on_hold: "moved to On hold",
  pulled: "process pulled",
  new_entry: "added to the tracker",
  flagged: "flagged for review",
};

export function describeEvent(eventType: string): string {
  return EVENT_LABEL[eventType] ?? "updated";
}

// Pure: matched (rule, event) pairs → idempotent notification rows. dedupe_key
// keeps the notify cron safe to run on overlapping windows.
export function alertNotificationRows(
  matches: { rule: AlertRule; event: AlertEvent }[]
): NotificationRow[] {
  return matches.map(({ rule, event }) => ({
    user_id: rule.userId,
    type: "alert",
    title: event.companyName,
    body: `${rule.name} — ${describeEvent(event.eventType)}`,
    entity_type: "company",
    entity_id: event.companyId,
    dedupe_key: `alert:${rule.id}:${event.companyId}:${event.eventType}:${event.at}`,
  }));
}

// Human summary of a predicate for the rules list, e.g.
// "Chemicals · carveout · enters In market · conviction ≥ 70".
const STAGE_LABEL: Record<Stage, string> = {
  in_market: "In market",
  monitor_for_exit: "Monitor for exit",
  on_hold: "On hold",
  pulled: "Pulled",
};

export function describeRule(p: AlertPredicate): string {
  const parts: string[] = [];
  if (p.sector) parts.push(p.sector.replace(/_/g, " "));
  if (p.dealType) parts.push(p.dealType === "carveout" ? "carveout" : "private asset");
  if (p.sponsorContains) parts.push(`sponsor ~ "${p.sponsorContains}"`);
  if (p.nameContains) parts.push(`name ~ "${p.nameContains}"`);
  if (p.stageEnters) parts.push(`enters ${STAGE_LABEL[p.stageEnters]}`);
  if (p.minConfidence) parts.push(`confidence ≥ ${p.minConfidence}`);
  if (p.minConviction != null) parts.push(`conviction ≥ ${p.minConviction}`);
  return parts.length ? parts.join(" · ") : "Any deal activity";
}
