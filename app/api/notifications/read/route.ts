import { type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { ok, fail, requireBackend, serverError } from "@/lib/api/respond";
import { getSessionUser } from "@/lib/api/auth";
import { parseJson } from "@/lib/validation";

// POST /api/notifications/read — { id? } mark one notification read, or all unread
// when no id. RLS limits the update to the user's own rows.
export async function POST(request: NextRequest) {
  const guard = requireBackend();
  if (guard) return guard;

  const supabase = await createClient();
  const user = await getSessionUser(supabase);
  if (!user) return fail("Unauthorized", 401);

  const parsed = await parseJson(request, z.object({ id: z.string().min(1).optional() }));
  if (!parsed.ok) return parsed.res;

  let q = supabase.from("notifications").update({ read_at: new Date().toISOString() });
  q = parsed.data.id ? q.eq("id", parsed.data.id) : q.is("read_at", null);
  const { error } = await q;
  if (error) return serverError(error);

  return ok({ ok: true });
}
