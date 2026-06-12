import { type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ok, fail, requireBackend, serverError } from "@/lib/api/respond";
import { getSessionUser } from "@/lib/api/auth";
import { auditAs } from "@/lib/audit";
import { getCrmProvider, hasCrmEnv, crmProviderLabel } from "@/lib/crm";
import type { CrmCompany } from "@/lib/crm";
import type { DbCompany, DbCrmSync } from "@/types/db";

interface CrmSyncView {
  provider: string;
  status: "synced" | "error";
  externalId: string | null;
  error: string | null;
  syncedAt: string;
}

function toView(row: DbCrmSync): CrmSyncView {
  return {
    provider: row.provider,
    status: row.status,
    externalId: row.external_id,
    error: row.error,
    syncedAt: row.synced_at,
  };
}

function toCrmCompany(c: DbCompany): CrmCompany {
  return {
    id: c.id,
    name: c.name,
    sector: c.sector,
    dealType: c.deal_type,
    stage: c.current_stage,
    confidence: c.confidence,
    sponsorFirm: c.sponsor_firm,
    parentCompany: c.parent_company,
    description: c.description,
    ourProcessStage: c.our_process_stage ?? null,
    website: null, // no website column yet; domain stays null
  };
}

// GET /api/companies/[id]/crm-sync — last sync status + whether a CRM is wired.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = requireBackend();
  if (guard) return guard;
  const { id } = await params;
  const supabase = await createClient();
  const user = await getSessionUser(supabase);
  if (!user) return fail("Unauthorized", 401);

  const { data, error } = await supabase
    .from("crm_sync")
    .select("*")
    .eq("company_id", id)
    .order("synced_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return serverError(error);

  return ok({
    configured: hasCrmEnv(),
    provider: crmProviderLabel(),
    sync: data ? toView(data as DbCrmSync) : null,
  });
}

// POST /api/companies/[id]/crm-sync — push this deal to the configured CRM.
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = requireBackend();
  if (guard) return guard;
  const { id } = await params;
  const supabase = await createClient();
  const user = await getSessionUser(supabase);
  if (!user) return fail("Unauthorized", 401);

  const provider = getCrmProvider();
  if (!provider) return fail("No CRM is configured", 503);

  const { data: co, error: cErr } = await supabase
    .from("companies")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (cErr) return serverError(cErr);
  if (!co) return fail("Not found", 404);

  const result = await provider.pushCompany(toCrmCompany(co as DbCompany));

  // Upsert the current sync row for this (company, provider).
  const { data: saved, error: sErr } = await supabase
    .from("crm_sync")
    .upsert(
      {
        company_id: id,
        org_id: user.orgId ?? null,
        created_by: user.id,
        provider: provider.name,
        external_id: result.externalId,
        status: result.ok ? "synced" : "error",
        error: result.error,
        synced_at: new Date().toISOString(),
      },
      { onConflict: "company_id,provider" }
    )
    .select("*")
    .maybeSingle();
  if (sErr) return serverError(sErr);

  await auditAs(user, "company.crm_sync", {
    entityType: "company",
    entityId: id,
    metadata: { provider: provider.name, ok: result.ok },
  });

  if (!result.ok) return fail(result.error ?? "CRM sync failed", 502);

  return ok({ sync: saved ? toView(saved as DbCrmSync) : null });
}
