import { createClient, createServiceClient } from "@/lib/supabase/server";
import { ok, fail, requireBackend } from "@/lib/api/respond";
import { getSessionUser } from "@/lib/api/auth";
import { planForOrg } from "@/lib/billing";

// GET /api/billing/plan — the caller's effective plan (downgraded to free if the
// subscription has lapsed). Available to any authenticated user.
export async function GET() {
  const guard = requireBackend();
  if (guard) return guard;
  const supabase = await createClient();
  const user = await getSessionUser(supabase);
  if (!user) return fail("Unauthorized", 401);

  const plan = await planForOrg(createServiceClient(), user.orgId ?? null);
  return ok({ plan });
}
