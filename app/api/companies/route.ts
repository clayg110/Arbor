import { type NextRequest, after } from "next/server";
import { z } from "zod";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { enrichCompanyOnAdd } from "@/lib/ingest/enrich";
import {
  ok,
  fail,
  requireBackend,
  csv,
  safeFilterValue,
  serverError,
  tooMany,
} from "@/lib/api/respond";
import { getSessionUser } from "@/lib/api/auth";
import { isFeatureEnabled } from "@/lib/flags";
import { auditAs } from "@/lib/audit";
import { rateLimit } from "@/lib/redis/ratelimit";
import {
  parseJson,
  sectorEnum,
  dealTypeEnum,
  stageEnum,
  confidenceEnum,
} from "@/lib/validation";
import { toRadarCompany, toSummaryStrip, toSectorSummary } from "@/lib/adapters";
import { isComputedSort, rankComputed, COMPUTED_SORT_CAP } from "@/lib/radar-rank";
import type {
  DbCompany,
  LastSignalRow,
  ConvictionRow,
  SummaryCountsRow,
  SectorStageRow,
} from "@/types/db";
import type { Confidence, Sector, DealType, Stage } from "@/lib/types";

const createCompanySchema = z.object({
  name: z.string().trim().min(1, "required").max(200),
  sector: sectorEnum,
  dealType: dealTypeEnum,
  sponsorFirm: z.string().trim().max(200).nullish(),
  parentCompany: z.string().trim().max(200).nullish(),
  stage: stageEnum.optional(),
  confidence: confidenceEnum.optional(),
  description: z.string().trim().max(2000).nullish(),
});

// GET /api/companies — radar list (filters + sort) + summary strip + sector cards.
export async function GET(request: NextRequest) {
  const guard = requireBackend();
  if (guard) return guard;

  const sp = request.nextUrl.searchParams;
  const sector = sp.get("sector");
  const deal = sp.get("deal");
  const sponsor = sp.get("sponsor");
  const q = sp.get("q")?.trim();
  const quick = sp.get("quick");
  const sort = sp.get("sort") ?? "days_desc";
  const limit = Math.min(Number(sp.get("limit") ?? 200), 500);
  const offset = Number(sp.get("offset") ?? 0);
  const confidence = csv(sp.get("confidence"));
  const stages = csv(sp.get("stage"));

  const supabase = await createClient();

  let query = supabase.from("companies").select("*", { count: "exact" });

  if (sector && sector !== "all") query = query.eq("sector", sector as Sector);
  if (deal && deal !== "all") query = query.eq("deal_type", deal as DealType);
  if (confidence.length) query = query.in("confidence", confidence as Confidence[]);
  if (stages.length) query = query.in("current_stage", stages as Stage[]);
  if (sponsor && sponsor !== "all") {
    const s = safeFilterValue(sponsor);
    query = query.or(`sponsor_firm.eq.${s},parent_company.eq.${s}`);
  }
  if (q) {
    const qq = safeFilterValue(q);
    query = query.or(
      `name.ilike.%${qq}%,sponsor_firm.ilike.%${qq}%,parent_company.ilike.%${qq}%`
    );
  }

  // quick filters (summary-strip blocks)
  if (quick === "in_market") query = query.eq("current_stage", "in_market");
  else if (quick === "monitor") query = query.eq("current_stage", "monitor_for_exit");
  else if (quick === "hold") query = query.in("current_stage", ["on_hold", "pulled"]);
  else if (quick === "needs_review") query = query.eq("confidence", "needs_review");
  else if (quick === "new_week") {
    const wk = new Date(Date.now() - 7 * 86_400_000).toISOString();
    query = query.gte("created_at", wk);
  }

  // DB-level sort (confidence handled after adapt)
  if (sort === "days_desc")
    query = query.order("current_stage_since", { ascending: true });
  else if (sort === "days_asc")
    query = query.order("current_stage_since", { ascending: false });
  else if (sort === "name_asc") query = query.order("name", { ascending: true });
  else if (sort === "name_desc") query = query.order("name", { ascending: false });
  else if (sort === "added_desc") query = query.order("created_at", { ascending: false });
  else query = query.order("name", { ascending: true });

  // Computed sorts (conviction/confidence) are ranked in app code after
  // adapting, so they need the whole filtered set — paginating at the DB first
  // would only let us reorder a single page. Bounded by COMPUTED_SORT_CAP.
  const computed = isComputedSort(sort);
  const { data, count, error } = computed
    ? await query.range(0, COMPUTED_SORT_CAP - 1)
    : await query.range(offset, offset + limit - 1);
  if (error) return serverError(error);

  const companies = (data ?? []) as DbCompany[];

  // last signal per company + the user's watchlist. The last-signal view has at
  // most one row per company with signals (small), so fetch it whole rather than
  // filtering by a 500-id IN clause (which made this route ~9s).
  const [
    { data: sigs },
    { data: wl },
    { data: summaryRows },
    { data: sectorRows },
    { data: convRows },
  ] = await Promise.all([
    supabase.from("v_company_last_signal").select("*"),
    supabase.from("watchlist").select("company_id"),
    supabase.from("v_summary_counts").select("*").limit(1),
    supabase.from("v_sector_stage").select("*"),
    supabase.from("v_company_conviction").select("*"),
  ]);

  const lastByCompany = new Map<string, LastSignalRow>();
  for (const s of (sigs ?? []) as LastSignalRow[]) lastByCompany.set(s.company_id, s);
  const convByCompany = new Map<string, ConvictionRow>();
  for (const r of (convRows ?? []) as ConvictionRow[]) convByCompany.set(r.company_id, r);
  const watched = new Set(
    (wl ?? []).map((r) => (r as { company_id: string }).company_id)
  );

  let radar = companies.map((c) => {
    const cv = convByCompany.get(c.id);
    return toRadarCompany(
      c,
      lastByCompany.get(c.id) ?? null,
      watched.has(c.id),
      cv
        ? {
            signalCount30d: cv.signal_count_30d,
            distinctSourceTypes: cv.distinct_source_types,
          }
        : null
    );
  });

  // Rank the full filtered set by the computed key, then slice to the page.
  if (computed) radar = rankComputed(radar, sort, offset, limit);

  const summary = (summaryRows?.[0] as SummaryCountsRow | undefined) ?? null;
  const sectors = (sectorRows ?? []) as SectorStageRow[];

  return ok({
    companies: radar,
    total: count ?? radar.length,
    summary: summary ? toSummaryStrip(summary) : null,
    sectorSummary: toSectorSummary(sectors),
  });
}

// POST /api/companies — add a company (the radar "Add company" form). Also
// writes a new_entry history row so it surfaces in the feed.
export async function POST(request: NextRequest) {
  const guard = requireBackend();
  if (guard) return guard;

  const supabase = await createClient();
  const user = await getSessionUser(supabase);
  if (!user) return fail("Unauthorized", 401);

  const limit = await rateLimit(user.id, {
    limit: 30,
    window: "1 m",
    prefix: "write:company",
  });
  if (!limit.ok) return tooMany(limit.reset);

  const parsed = await parseJson(request, createCompanySchema);
  if (!parsed.ok) return parsed.res;
  const body = parsed.data;

  const stage: Stage = (body.stage as Stage) ?? "in_market";
  const confidence: Confidence = (body.confidence as Confidence) ?? "needs_review";

  const { data: created, error } = await supabase
    .from("companies")
    .insert({
      name: body.name,
      sector: body.sector as Sector,
      deal_type: body.dealType as DealType,
      sponsor_firm: body.sponsorFirm?.trim() || null,
      parent_company: body.parentCompany?.trim() || null,
      description: body.description?.trim() || null,
      current_stage: stage,
      confidence,
    })
    .select("*")
    .single();
  if (error) return serverError(error);

  const c = created as DbCompany;
  await supabase.from("deal_stage_history").insert({
    company_id: c.id,
    stage,
    event_type: "new_entry",
    changed_by: "analyst_manual",
    source_type: "manual",
    headline: `Added to tracker — ${c.name}`,
  });

  await auditAs(user, "company.create", {
    entityType: "company",
    entityId: c.id,
    metadata: { name: c.name, sector: c.sector, dealType: c.deal_type, stage },
  });

  // Enrich-on-add: kick a targeted web search for this company after the
  // response is sent (next/server `after`), so the add stays instant. No-op
  // without Google CSE env. Service client because this runs outside the
  // request's auth context.
  after(async () => {
    try {
      // Kill switch: an `integration.enrich` flag set to disabled skips the
      // web-search enrichment without a redeploy. Defaults ON.
      if (!(await isFeatureEnabled("integration.enrich", user.orgId))) return;
      await enrichCompanyOnAdd(createServiceClient(), c.name, c.deal_type as DealType);
    } catch {
      // best-effort enrichment — never affects the add
    }
  });

  return ok({ company: toRadarCompany(c) }, { status: 201 });
}
