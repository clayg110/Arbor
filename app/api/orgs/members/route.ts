import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/server";
import { ok, fail, requireBackend } from "@/lib/api/respond";
import { getSessionUser } from "@/lib/api/auth";
import { nameToHandle } from "@/lib/mentions";
import type { OrgMember } from "@/lib/mentions";

export const dynamic = "force-dynamic";

// GET /api/orgs/members — list members of the caller's org for @mention autocomplete.
// Non-admin; scoped to caller's org_id. Returns [] in mock mode or for solo users.
export async function GET() {
  const guard = requireBackend();
  if (guard) return guard;
  const supabase = await createClient();
  const user = await getSessionUser(supabase);
  if (!user) return fail("Unauthorized", 401);
  const orgId = user.orgId ?? null;
  if (!orgId) return ok({ members: [] as OrgMember[] });

  const svc = createServiceClient();
  const { data } = await svc.auth.admin.listUsers({ perPage: 200 });
  const members: OrgMember[] = (data?.users ?? [])
    .filter((u) => (u.app_metadata?.org_id as string | undefined) === orgId)
    .map((u) => {
      const rawName =
        (u.user_metadata?.name as string | undefined) ??
        u.email?.split("@")[0] ??
        "Member";
      return { id: u.id, name: rawName, handle: nameToHandle(rawName) };
    })
    .filter((m) => m.handle.length > 0);

  return ok({ members });
}
