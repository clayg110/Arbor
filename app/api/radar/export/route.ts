import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  requireBackend,
  fail,
  serverError,
  safeFilterValue,
  csv,
} from "@/lib/api/respond";
import { getSessionUser } from "@/lib/api/auth";
import { toRadarCompany } from "@/lib/adapters";
import { radarToCsv } from "@/lib/radar-csv";
import type { DbCompany, LastSignalRow, ConvictionRow } from "@/types/db";
import type { Confidence, Sector, DealType, Stage } from "@/lib/types";

// GET /api/radar/export — download current radar as CSV (respects filter params).
// Auth required; no pagination (cap 5000).
export async function GET(request: NextRequest) {
  const guard = requireBackend();
  if (guard) return guard;

  const supabase = await createClient();
  const user = await getSessionUser(supabase);
  if (!user) return fail("Unauthorized", 401);

  const sp = request.nextUrl.searchParams;
  const sector = sp.get("sector");
  const deal = sp.get("deal");
  const sponsor = sp.get("sponsor");
  const q = sp.get("q")?.trim();
  const confidence = csv(sp.get("confidence"));
  const stages = csv(sp.get("stage"));

  let query = supabase.from("companies").select("*");

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

  const { data, error } = await query.order("name").limit(5000);
  if (error) return serverError(error);

  const companies = (data ?? []) as DbCompany[];
  const ids = companies.map((c) => c.id);

  const [{ data: sigs }, { data: convRows }] = await Promise.all([
    supabase.from("v_company_last_signal").select("*").in("company_id", ids),
    supabase.from("v_company_conviction").select("*").in("company_id", ids),
  ]);

  const lastByCompany = new Map<string, LastSignalRow>();
  for (const s of (sigs ?? []) as LastSignalRow[]) lastByCompany.set(s.company_id, s);
  const convByCompany = new Map<string, ConvictionRow>();
  for (const r of (convRows ?? []) as ConvictionRow[]) convByCompany.set(r.company_id, r);

  const radar = companies.map((c) => {
    const cv = convByCompany.get(c.id);
    return toRadarCompany(
      c,
      lastByCompany.get(c.id) ?? null,
      false,
      cv
        ? {
            signalCount30d: cv.signal_count_30d,
            distinctSourceTypes: cv.distinct_source_types,
          }
        : null
    );
  });

  const body = radarToCsv(radar);
  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="arbor-radar.csv"',
    },
  });
}
