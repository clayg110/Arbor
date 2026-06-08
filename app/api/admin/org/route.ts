import { type NextRequest } from "next/server";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/server";
import { ok, requireBackend, serverError } from "@/lib/api/respond";
import { requireAdmin } from "@/lib/api/auth";
import { auditAs } from "@/lib/audit";
import { parseJson } from "@/lib/validation";
import { seatLimit } from "@/lib/seats";
import type { DbOrg } from "@/types/db";

const renameSchema = z.object({ name: z.string().trim().min(1, "required").max(120) });

// GET /api/admin/org — the admin's organization + member count. Returns
// { org: null } for a single-tenant admin (no org_id).
export async function GET() {
  const guard = requireBackend();
  if (guard) return guard;
  const gate = await requireAdmin();
  if (gate.res) return gate.res;

  if (!gate.user.orgId) return ok({ org: null });

  const svc = createServiceClient();
  const { data, error } = await svc
    .from("orgs")
    .select("*")
    .eq("id", gate.user.orgId)
    .maybeSingle();
  if (error) return serverError(error);

  const { data: list } = await svc.auth.admin.listUsers();
  const memberCount = (list?.users ?? []).filter(
    (u) => (u.app_metadata?.org_id as string | undefined) === gate.user.orgId
  ).length;

  const org = data as DbOrg | null;
  return ok({
    org: org
      ? {
          id: org.id,
          name: org.name,
          createdAt: org.created_at,
          memberCount,
          plan: org.plan ?? "free",
          subscriptionStatus: org.subscription_status ?? null,
          currentPeriodEnd: org.current_period_end ?? null,
          seatsUsed: memberCount,
          seatLimit: seatLimit(org.plan, org.seats ?? null),
        }
      : null,
  });
}

// PATCH /api/admin/org — { name } rename the admin's organization.
export async function PATCH(request: NextRequest) {
  const guard = requireBackend();
  if (guard) return guard;
  const gate = await requireAdmin();
  if (gate.res) return gate.res;
  if (!gate.user.orgId) return ok({ org: null });

  const parsed = await parseJson(request, renameSchema);
  if (!parsed.ok) return parsed.res;

  const svc = createServiceClient();
  const { error } = await svc
    .from("orgs")
    .update({ name: parsed.data.name })
    .eq("id", gate.user.orgId);
  if (error) return serverError(error);

  await auditAs(gate.user, "org.rename", {
    entityType: "org",
    entityId: gate.user.orgId,
    metadata: { name: parsed.data.name },
  });

  return ok({ ok: true, name: parsed.data.name });
}
