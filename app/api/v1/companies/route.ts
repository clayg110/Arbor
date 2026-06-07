import { type NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { fail, requireBackend, serverError, tooMany } from "@/lib/api/respond";
import { bearerFrom, verifyApiKey } from "@/lib/api-keys";
import { rateLimit, clientIp } from "@/lib/redis/ratelimit";
import { logAudit } from "@/lib/audit";
import type { DbCompany } from "@/types/db";
import type { Sector, DealType, Stage } from "@/lib/types";

export const maxDuration = 30;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
  "Access-Control-Max-Age": "86400",
};

// CORS preflight.
export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

// Public read API. Authenticate with `Authorization: Bearer arbor_...`.
// GET /api/v1/companies?sector=&deal=&stage=&limit=&offset=
export async function GET(request: NextRequest) {
  const guard = requireBackend();
  if (guard) return guard;

  // Throttle invalid-key spam by IP before the (hashed) lookup.
  const ipRl = await rateLimit(clientIp(request), { limit: 300, window: "1 m", prefix: "apiv1:ip" });
  if (!ipRl.ok) return tooMany(ipRl.reset);

  const token = bearerFrom(request.headers.get("authorization"));
  if (!token) return fail("Missing API key", 401);

  const svc = createServiceClient();
  const key = await verifyApiKey(svc, token);
  if (!key) return fail("Invalid or revoked API key", 401);

  // Per-key quota.
  const rl = await rateLimit(key.keyId, { limit: 120, window: "1 m", prefix: "apiv1:key" });
  if (!rl.ok) return tooMany(rl.reset);

  const sp = request.nextUrl.searchParams;
  const sector = sp.get("sector");
  const deal = sp.get("deal");
  const stage = sp.get("stage");
  const limit = Math.min(Math.max(Number(sp.get("limit") ?? 100), 1), 500);
  const offset = Math.max(Number(sp.get("offset") ?? 0), 0);

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

  return NextResponse.json(
    { companies, total: count ?? companies.length, limit, offset },
    { headers: { ...CORS, "Cache-Control": "no-store" } }
  );
}
