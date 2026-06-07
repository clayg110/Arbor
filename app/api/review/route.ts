import { createClient } from "@/lib/supabase/server";
import { ok, requireBackend, serverError } from "@/lib/api/respond";
import { toReviewRow } from "@/lib/adapters";
import type { DbCompany, DbSignal } from "@/types/db";

// GET /api/review — companies flagged needs_review + conflicting signals.
export async function GET() {
  const guard = requireBackend();
  if (guard) return guard;

  const supabase = createClient();
  const { data: companies, error } = await supabase
    .from("companies")
    .select("*")
    .eq("confidence", "needs_review")
    .order("updated_at", { ascending: false });
  if (error) return serverError(error);

  const rows = await Promise.all(
    ((companies ?? []) as DbCompany[]).map(async (c) => {
      const { data: sigs } = await supabase
        .from("signals_raw")
        .select("*")
        .eq("company_id", c.id)
        .order("ingested_at", { ascending: false })
        .limit(3);
      return toReviewRow(c, (sigs ?? []) as DbSignal[]);
    })
  );

  return ok({ rows });
}
