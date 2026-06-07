import { type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ok, requireBackend, csv, serverError } from "@/lib/api/respond";
import { toFeedItem, type CompanyMin } from "@/lib/adapters";
import type { DbHistory, DbFeedEvent, LlmOutput } from "@/types/db";
import type { DealType, Sector, Confidence } from "@/lib/types";

const STAGE_CHANGE: DbFeedEvent[] = ["moved_in_market", "moved_monitor", "moved_on_hold", "pulled"];

// Joined history row shape from the embed select.
type FeedRow = DbHistory & {
  company: {
    id: string;
    name: string;
    deal_type: DealType;
    sector: Sector;
    confidence: Confidence;
  } | null;
  signal: { llm_output: LlmOutput | null } | null;
};

// GET /api/feed — activity feed (range + filters) → FeedItemData[].
export async function GET(request: NextRequest) {
  const guard = requireBackend();
  if (guard) return guard;

  const sp = request.nextUrl.searchParams;
  const type = sp.get("type") ?? "all";
  const sectors = csv(sp.get("sector"));
  const deals = csv(sp.get("deal"));
  const watchOnly = sp.get("watchOnly") === "1";
  const highConfOnly = sp.get("highConf") === "1";
  const from = sp.get("from");
  const to = sp.get("to");
  const limit = Math.min(Number(sp.get("limit") ?? 150), 400);

  const supabase = createClient();

  let query = supabase
    .from("deal_stage_history")
    .select(
      "*, company:companies(id,name,deal_type,sector,confidence), signal:signals_raw(llm_output)"
    )
    .order("changed_at", { ascending: false })
    .limit(limit);

  if (type === "stage_changes") query = query.in("event_type", STAGE_CHANGE);
  else if (type === "new_entries") query = query.eq("event_type", "new_entry");
  else if (type === "flagged") query = query.eq("event_type", "flagged");

  if (from) query = query.gte("changed_at", from);
  if (to) query = query.lte("changed_at", to + "T23:59:59");

  const { data, error } = await query;
  if (error) return serverError(error);

  // user watchlist (for watchOnly)
  let watched = new Set<string>();
  if (watchOnly) {
    const { data: wl } = await supabase.from("watchlist").select("company_id");
    watched = new Set((wl ?? []).map((r) => (r as { company_id: string }).company_id));
  }

  const rows = (data ?? []) as unknown as FeedRow[];

  const items = rows
    .filter((r) => r.company)
    .filter((r) => sectors.length === 0 || sectors.includes(r.company!.sector))
    .filter((r) => deals.length === 0 || deals.includes(r.company!.deal_type))
    .filter((r) => !highConfOnly || !["needs_review", "low"].includes(r.company!.confidence))
    .filter((r) => !watchOnly || watched.has(r.company!.id))
    .map((r) => {
      const company: CompanyMin = {
        id: r.company!.id,
        name: r.company!.name,
        dealType: r.company!.deal_type,
        sector: r.company!.sector,
        confidence: r.company!.confidence,
      };
      return toFeedItem(r, company, r.signal?.llm_output ?? null);
    });

  return ok({ items });
}
