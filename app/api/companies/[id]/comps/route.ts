import { type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ok, fail, requireBackend, serverError } from "@/lib/api/respond";
import { getSessionUser } from "@/lib/api/auth";
import { topComps, type CompInput } from "@/lib/comps";
import type { DbCompany } from "@/types/db";

// GET /api/companies/[id]/comps — top comparable deals for this company.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = requireBackend();
  if (guard) return guard;

  const { id } = await params;
  const supabase = await createClient();
  const user = await getSessionUser(supabase);
  if (!user) return fail("Unauthorized", 401);

  const { data: company, error: ce } = await supabase
    .from("companies")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (ce) return serverError(ce);
  if (!company) return fail("Not found", 404);

  const c = company as DbCompany;

  // Build filter parts safely — null sector/deal_type would produce literal "null" in the query.
  const orParts: string[] = [];
  if (c.sector) orParts.push(`sector.eq.${c.sector}`);
  if (c.deal_type) orParts.push(`deal_type.eq.${c.deal_type}`);
  if (orParts.length === 0) return ok({ comps: [] });

  const { data: candidates, error: ke } = await supabase
    .from("companies")
    .select("*")
    .or(orParts.join(","))
    .neq("id", id)
    .limit(100);
  if (ke) return serverError(ke);

  const target: CompInput = {
    id: c.id,
    name: c.name,
    sector: c.sector,
    dealType: c.deal_type,
    stage: c.current_stage,
    revenue: c.revenue,
    ebitda: c.ebitda,
    outcome: c.outcome,
  };

  const cands: CompInput[] = ((candidates ?? []) as DbCompany[]).map((r) => ({
    id: r.id,
    name: r.name,
    sector: r.sector,
    dealType: r.deal_type,
    stage: r.current_stage,
    revenue: r.revenue,
    ebitda: r.ebitda,
    outcome: r.outcome,
  }));

  return ok({ comps: topComps(target, cands) });
}
