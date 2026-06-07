import { type NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { ok, requireBackend, serverError } from "@/lib/api/respond";
import { requireAdmin } from "@/lib/api/auth";
import type { DbAuditLog } from "@/types/db";

// GET /api/admin/audit?limit= — recent audit entries for the admin's org.
export async function GET(request: NextRequest) {
  const guard = requireBackend();
  if (guard) return guard;
  const gate = await requireAdmin();
  if (gate.res) return gate.res;

  const limit = Math.min(Number(request.nextUrl.searchParams.get("limit") ?? 100), 500);

  const svc = createServiceClient();
  let query = svc
    .from("audit_log")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  // Org-scope when the admin belongs to an org; otherwise show the global stream.
  if (gate.user.orgId) query = query.eq("org_id", gate.user.orgId);

  const { data, error } = await query;
  if (error) return serverError(error);

  const entries = (data ?? []).map((e) => {
    const a = e as DbAuditLog;
    return {
      id: a.id,
      action: a.action,
      entityType: a.entity_type,
      entityId: a.entity_id,
      actorEmail: a.actor_email,
      metadata: a.metadata,
      createdAt: a.created_at,
    };
  });

  return ok({ entries });
}
