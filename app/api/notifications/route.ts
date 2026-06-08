import { createClient } from "@/lib/supabase/server";
import { ok, fail, requireBackend, serverError } from "@/lib/api/respond";
import { getSessionUser } from "@/lib/api/auth";
import type { DbNotification } from "@/types/db";

// GET /api/notifications — the signed-in user's recent notifications + unread
// count. RLS scopes rows to the user.
export async function GET() {
  const guard = requireBackend();
  if (guard) return guard;

  const supabase = await createClient();
  const user = await getSessionUser(supabase);
  if (!user) return fail("Unauthorized", 401);

  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) return serverError(error);

  const rows = (data ?? []) as DbNotification[];
  const notifications = rows.map((n) => ({
    id: n.id,
    type: n.type,
    title: n.title,
    body: n.body,
    entityType: n.entity_type,
    entityId: n.entity_id,
    readAt: n.read_at,
    createdAt: n.created_at,
  }));
  const unread = rows.filter((n) => !n.read_at).length;

  return ok({ notifications, unread });
}
