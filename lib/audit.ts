// Append-only audit trail. Writes through the service role (RLS-protected table —
// clients can't read or write it directly). Best-effort: a logging failure must
// never break the action being audited.

import { createServiceClient, hasSupabaseEnv } from "@/lib/supabase/server";
import type { SessionUser } from "@/lib/api/auth";

export interface AuditEntry {
  action: string; // "company.stage_override", "note.create", "user.role_change", ...
  entityType?: string; // "company" | "note" | "user" | "api_key" | ...
  entityId?: string | null;
  userId?: string | null;
  actorEmail?: string | null;
  orgId?: string | null;
  metadata?: Record<string, unknown>;
}

export async function logAudit(entry: AuditEntry): Promise<void> {
  if (!hasSupabaseEnv() || !process.env.SUPABASE_SERVICE_ROLE_KEY) return;
  try {
    await createServiceClient()
      .from("audit_log")
      .insert({
        action: entry.action,
        entity_type: entry.entityType ?? null,
        entity_id: entry.entityId ?? null,
        user_id: entry.userId ?? null,
        actor_email: entry.actorEmail ?? null,
        org_id: entry.orgId ?? null,
        metadata: entry.metadata ?? null,
      });
  } catch {
    // audit is best-effort
  }
}

// Convenience overload for the common "current user did X" case.
export function auditAs(
  user: Pick<SessionUser, "id" | "email" | "orgId">,
  action: string,
  rest: Omit<AuditEntry, "action" | "userId" | "actorEmail" | "orgId"> = {}
): Promise<void> {
  return logAudit({
    action,
    userId: user.id,
    actorEmail: user.email,
    orgId: user.orgId,
    ...rest,
  });
}
