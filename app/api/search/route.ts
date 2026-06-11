import { type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ok, requireBackend, csv, safeFilterValue, serverError } from "@/lib/api/respond";
import {
  hasTypesenseEnv,
  typesenseClient,
  COMPANIES_COLLECTION,
  type CompanyDoc,
} from "@/lib/typesense/client";
import { parseNlQuery } from "@/lib/nl-search";
import type { Sector, DealType, Confidence, Stage } from "@/lib/types";

interface SearchHit {
  id: string;
  name: string;
  sector: Sector;
  dealType: DealType;
  confidence: Confidence;
  currentStage: Stage;
  owner: string;
}

function docToHit(d: CompanyDoc): SearchHit {
  return {
    id: d.id,
    name: d.name,
    sector: d.sector as Sector,
    dealType: d.deal_type as DealType,
    confidence: d.confidence as Confidence,
    currentStage: d.current_stage as Stage,
    owner: d.sponsor_firm || d.parent_company || "Undisclosed",
  };
}

// GET /api/search?q&sector&deal&confidence&stage
// Typesense when configured; otherwise a Supabase ilike fallback. Returns a
// Typesense-shaped payload so the client never needs to know which ran.
// Supports natural-language queries: "high chemicals in market" auto-parses
// recognized keywords; explicit filter params override any NL-parsed values.
export async function GET(request: NextRequest) {
  const guard = requireBackend();
  if (guard) return guard;

  const sp = request.nextUrl.searchParams;
  const rawQ = sp.get("q")?.trim() ?? "";
  const nl = parseNlQuery(rawQ);

  // Explicit filter params override NL-parsed values.
  const q = nl.text ?? "";
  const sector = sp.get("sector") ?? nl.sector ?? null;
  const deal = sp.get("deal") ?? nl.dealType ?? null;
  const confidence = csv(sp.get("confidence")).length
    ? csv(sp.get("confidence"))
    : nl.confidence
      ? [nl.confidence]
      : [];
  const stages = csv(sp.get("stage")).length
    ? csv(sp.get("stage"))
    : nl.stage
      ? [nl.stage]
      : [];

  // ---- Typesense path ----
  if (hasTypesenseEnv()) {
    try {
      const filters: string[] = [];
      if (sector && sector !== "all") filters.push(`sector:=${sector}`);
      if (deal && deal !== "all") filters.push(`deal_type:=${deal}`);
      if (confidence.length) filters.push(`confidence:[${confidence.join(",")}]`);
      if (stages.length) filters.push(`current_stage:[${stages.join(",")}]`);

      const res = await typesenseClient()
        .collections(COMPANIES_COLLECTION)
        .documents()
        .search({
          q: q || "*",
          query_by: "name,sponsor_firm,parent_company",
          filter_by: filters.join(" && ") || undefined,
          per_page: 25,
        });

      const hits = (res.hits ?? []).map((h) => ({
        document: docToHit(h.document as CompanyDoc),
      }));
      return ok({ found: res.found ?? hits.length, hits, source: "typesense" });
    } catch {
      // fall through to Supabase on any Typesense error (e.g. missing collection)
    }
  }

  // ---- Supabase ilike fallback ----
  const supabase = await createClient();
  let query = supabase
    .from("companies")
    .select(
      "id,name,sector,deal_type,sponsor_firm,parent_company,current_stage,confidence"
    )
    .limit(25);

  if (sector && sector !== "all") query = query.eq("sector", sector as Sector);
  if (deal && deal !== "all") query = query.eq("deal_type", deal as DealType);
  if (confidence.length) query = query.in("confidence", confidence as Confidence[]);
  if (stages.length) query = query.in("current_stage", stages as Stage[]);
  if (q) {
    const qq = safeFilterValue(q);
    query = query.or(
      `name.ilike.%${qq}%,sponsor_firm.ilike.%${qq}%,parent_company.ilike.%${qq}%`
    );
  }

  const { data, error } = await query;
  if (error) return serverError(error);

  const hits = (data ?? []).map((r) => ({
    document: {
      id: r.id,
      name: r.name,
      sector: r.sector,
      dealType: r.deal_type,
      confidence: r.confidence,
      currentStage: r.current_stage,
      owner: r.sponsor_firm || r.parent_company || "Undisclosed",
    } as SearchHit,
  }));

  return ok({ found: hits.length, hits, source: "supabase" });
}
