// In-app notifications. Shares the digest's change model: recentStageChanges
// reads the activity window (used by both the email digest and the notify cron);
// toNotificationRows is the pure mapping (tested); createNotifications upserts
// idempotently via dedupe_key.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/db";
import type { DigestChange, UserDigest } from "@/lib/digest";

const ACTION: Record<string, string> = {
  moved_in_market: "Moved to In market",
  moved_monitor: "Moved to Monitor for exit",
  moved_on_hold: "Moved to On hold",
  pulled: "Process pulled",
  new_entry: "Added to tracker",
  flagged: "Flagged for review",
};

type HistRow = {
  company_id: string;
  event_type: string;
  changed_at: string;
  company: { name: string } | null;
};

// Recent feed-worthy stage changes since `sinceIso` (newest first).
export async function recentStageChanges(
  svc: SupabaseClient<Database>,
  sinceIso: string
): Promise<DigestChange[]> {
  const { data } = await svc
    .from("deal_stage_history")
    .select("company_id,event_type,changed_at,company:companies(name)")
    .gte("changed_at", sinceIso)
    .order("changed_at", { ascending: false })
    .limit(1000);

  return ((data ?? []) as unknown as HistRow[])
    .filter((h) => h.company)
    .map((h) => ({
      companyId: h.company_id,
      companyName: h.company!.name,
      action: ACTION[h.event_type] ?? "Updated",
      at: h.changed_at,
    }));
}

export interface NotificationRow {
  user_id: string;
  type: string;
  title: string;
  body: string;
  entity_type: string;
  entity_id: string;
  dedupe_key: string;
}

// Pure: per-user digests → notification rows (one per change). dedupe_key keeps
// the notify cron idempotent across overlapping windows.
export function toNotificationRows(digests: UserDigest[]): NotificationRow[] {
  const rows: NotificationRow[] = [];
  for (const d of digests) {
    for (const i of d.items) {
      rows.push({
        user_id: d.userId,
        type: "watchlist",
        title: i.companyName,
        body: i.action,
        entity_type: "company",
        entity_id: i.companyId,
        dedupe_key: `${d.userId}:${i.companyId}:${i.at}`,
      });
    }
  }
  return rows;
}

// Idempotent upsert of notification rows (shared by watchlist digests + alert
// rules). dedupe_key collisions are ignored, so overlapping cron windows don't
// double-notify. Returns the number of NEW rows written.
export async function upsertNotificationRows(
  svc: SupabaseClient<Database>,
  rows: NotificationRow[]
): Promise<number> {
  if (rows.length === 0) return 0;
  const { data, error } = await svc
    .from("notifications")
    .upsert(rows, { onConflict: "dedupe_key", ignoreDuplicates: true })
    .select("id");
  return error ? 0 : (data?.length ?? 0);
}

export function createNotifications(
  svc: SupabaseClient<Database>,
  digests: UserDigest[]
): Promise<number> {
  return upsertNotificationRows(svc, toNotificationRows(digests));
}
