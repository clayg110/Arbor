import { type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ok, requireBackend, serverError } from "@/lib/api/respond";
import { toSummaryStrip, toSectorSummary, toRangeStats } from "@/lib/adapters";
import type { SummaryCountsRow, SectorStageRow, EventCountsRow } from "@/types/db";

// GET /api/stats/summary?from&to
//   summary strip (radar) + sector cards + range event counts (feed sidebar).
export async function GET(request: NextRequest) {
  const guard = requireBackend();
  if (guard) return guard;

  const sp = request.nextUrl.searchParams;
  const from = sp.get("from");
  const to = sp.get("to");
  const range = from && to ? { p_from: from, p_to: to } : {};

  const supabase = await createClient();

  const [summary, sectors, events] = await Promise.all([
    supabase.from("v_summary_counts").select("*").limit(1),
    supabase.from("v_sector_stage").select("*"),
    supabase.rpc("rpc_event_counts", range),
  ]);

  const err = summary.error || sectors.error || events.error;
  if (err) return serverError(err);

  const summaryRow = (summary.data?.[0] as SummaryCountsRow | undefined) ?? null;
  const eventRow = (events.data?.[0] as EventCountsRow | undefined) ?? null;

  return ok({
    summary: summaryRow ? toSummaryStrip(summaryRow) : null,
    sectorSummary: toSectorSummary((sectors.data ?? []) as SectorStageRow[]),
    rangeStats: eventRow ? toRangeStats(eventRow) : null,
  });
}
