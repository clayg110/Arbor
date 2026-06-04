// Universe monitoring (Backend §2.1): rotate through the tracked company
// universe, least-recently-scanned first, and look for divestiture / carve-out
// signals via Google CSE. Found signals feed the same extract → resolve →
// persist path, creating a deal when a sale is detected.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/db";
import { fetchDivestitureSignals, hasGoogleEnv, type WebSignal } from "./google";

type Svc = SupabaseClient<Database>;

export async function fetchUniverseSignals(
  svc: Svc,
  limit = 20,
  perCompany = 2
): Promise<{ signals: WebSignal[]; scannedIds: string[] }> {
  if (!hasGoogleEnv()) return { signals: [], scannedIds: [] };

  const { data } = await svc
    .from("universe_companies")
    .select("id,name")
    .order("last_scanned_at", { ascending: true, nullsFirst: true })
    .limit(limit);

  const rows = (data ?? []) as { id: string; name: string }[];
  const signals: WebSignal[] = [];
  for (const c of rows) {
    const ws = await fetchDivestitureSignals(c.name, perCompany);
    signals.push(...ws);
  }
  return { signals, scannedIds: rows.map((r) => r.id) };
}

export async function markUniverseScanned(svc: Svc, ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  await svc
    .from("universe_companies")
    .update({ last_scanned_at: new Date().toISOString() })
    .in("id", ids);
}
