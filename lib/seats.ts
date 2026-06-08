// Seat metering. Paid plans are seat-bound by the Stripe subscription quantity
// (orgs.seats); the free plan gets FREE_SEATS. A null limit = unlimited (used as
// a fail-open when seats aren't synced, so paying customers are never locked out).

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/db";

export function freeSeats(): number {
  const n = Number(process.env.FREE_SEATS ?? 3);
  return Number.isFinite(n) && n > 0 ? n : 3;
}

export function seatLimit(
  plan: string | null | undefined,
  orgSeats: number | null | undefined
): number | null {
  if (plan === "pro" || plan === "enterprise") return orgSeats ?? null;
  return freeSeats();
}

export interface SeatStatus {
  used: number;
  limit: number | null; // null = unlimited
  available: number | null;
  full: boolean;
}

export function seatStatus(memberCount: number, limit: number | null): SeatStatus {
  if (limit == null)
    return { used: memberCount, limit: null, available: null, full: false };
  return {
    used: memberCount,
    limit,
    available: Math.max(0, limit - memberCount),
    full: memberCount >= limit,
  };
}

// Effective seat status for an org. Single-tenant (no org) is unlimited. Fails
// OPEN — a count/query error never blocks adding members.
export async function getSeatStatus(
  svc: SupabaseClient<Database>,
  orgId: string | null
): Promise<SeatStatus> {
  if (!orgId) return seatStatus(0, null);
  try {
    const { data } = await svc
      .from("orgs")
      .select("plan, seats")
      .eq("id", orgId)
      .maybeSingle();
    const row = data as { plan?: string; seats?: number | null } | null;
    const { data: list } = await svc.auth.admin.listUsers();
    const count = (list?.users ?? []).filter(
      (u) => (u.app_metadata?.org_id as string | undefined) === orgId
    ).length;
    return seatStatus(count, seatLimit(row?.plan, row?.seats ?? null));
  } catch {
    return seatStatus(0, null);
  }
}
