import { type NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { ok, fail, requireBackend, serverError } from "@/lib/api/respond";
import { bearerFrom, verifyApiKey } from "@/lib/api-keys";
import { logAudit } from "@/lib/audit";
import type { DbCompany } from "@/types/db";
import type { Sector, DealType, Stage } from "@/lib/types";

export const maxDuration = 30;

// Public read API. Authenticate with `Authorization: Bearer arbor_...`.
// GET /api/v1/companies?sector=&deal=&stage=&limit=&offset=
export async function GET(request: NextRequest) {
  const guard = requireBackend();
  if (guard) return guard;

  const token = bearerFrom(request.headers.get("authorization"));
  if (!token) return fail("Missing API key", 401);

  const svc = createServiceClient();
  const key = await verifyApiKey(svc, token);
  if (!key) return fail("Invalid or revoked API key", 401);

  const sp = request.nextUrl.searchParams;
  const sector = sp.get("sector");
  const deal = sp.get("deal");
  const stage = sp.get("stage");
  const limit = Math.min(Number(sp.get("limit") ?? 100), 500);
  const offset = Number(sp.get("offset") ?? 0);

  let query = svc.from("companies").select("*", { count: "exact" });
  if (sector) query = query.eq("sector", sector as Sector);
  if (deal) query = query.eq("deal_type", deal as DealType);
  if (stage) query = query.eq("current_stage", stage as Stage);
  query = query.order("updated_at", { ascending: false }).range(offset, offset + limit - 1);

  const { data, count, error } = await query;
  if (error) return serverError(error);

  const companies = ((data ?? []) as DbCompany[]).map((c) => ({
    id: c.id,
    name: c.name,
    sector: c.sector,
    dealType: c.deal_type,
    stage: c.current_stage,
    confidence: c.confidence,
    sponsorFirm: c.sponsor_firm,
    parentCompany: c.parent_company,
    revenue: c.revenue,
    ebitda: c.ebitda,
    updatedAt: c.updated_at,
  }));

  void logAudit({
    action: "api.companies.read",
    entityType: "api_key",
    entityId: key.keyId,
    orgId: key.orgId,
    metadata: { count: companies.length, filters: { sector, deal, stage } },
  });

  return ok({ companies, total: count ?? companies.length, limit, offset });
}
