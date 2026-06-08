import { type NextRequest } from "next/server";
import { z } from "zod";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { ok, fail, requireBackend, serverError } from "@/lib/api/respond";
import { getSessionUser } from "@/lib/api/auth";
import { auditAs } from "@/lib/audit";
import { parseJson } from "@/lib/validation";
import type { DbOrg } from "@/types/db";

const createSchema = z.object({ name: z.string().trim().min(1, "required").max(120) });

// POST /api/orgs — { name }
// Self-serve onboarding: an authenticated user with no org creates one and
// becomes its admin. The new org_id is written to app_metadata, so the caller
// must refresh their session (supabase.auth.refreshSession) for it to appear in
// the JWT and unlock org-scoped data.
export async function POST(request: NextRequest) {
  const guard = requireBackend();
  if (guard) return guard;

  const user = await getSessionUser(await createClient());
  if (!user) return fail("Unauthorized", 401);
  if (user.orgId) return fail("You already belong to an organization", 409);

  const parsed = await parseJson(request, createSchema);
  if (!parsed.ok) return parsed.res;

  const svc = createServiceClient();
  const { data, error } = await svc
    .from("orgs")
    .insert({ name: parsed.data.name })
    .select("*")
    .single();
  if (error) return serverError(error);
  const org = data as DbOrg;

  const { data: existing } = await svc.auth.admin.getUserById(user.id);
  const { error: updErr } = await svc.auth.admin.updateUserById(user.id, {
    app_metadata: { org_id: org.id },
    user_metadata: { ...(existing?.user?.user_metadata ?? {}), role: "admin" },
  });
  if (updErr) return serverError(updErr);

  await auditAs({ id: user.id, email: user.email, orgId: org.id }, "org.create", {
    entityType: "org",
    entityId: org.id,
    metadata: { name: org.name },
  });

  return ok({
    ok: true,
    org: { id: org.id, name: org.name },
    refreshRequired: true,
  });
}
