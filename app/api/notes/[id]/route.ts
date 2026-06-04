import { type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ok, fail, requireBackend } from "@/lib/api/respond";
import { getSessionUser } from "@/lib/api/auth";
import { toNotes } from "@/lib/adapters";
import type { DbNote } from "@/types/db";

// PATCH /api/notes/[id] — edit own note. RLS (notes_write: auth.uid()=user_id)
// is the real guard; we also scope the update by user_id for clarity.
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const guard = requireBackend();
  if (guard) return guard;

  const supabase = createClient();
  const user = await getSessionUser(supabase);
  if (!user) return fail("Unauthorized", 401);

  let body: { content?: string };
  try {
    body = await request.json();
  } catch {
    return fail("Invalid JSON body");
  }
  if (!body.content?.trim()) return fail("content required");

  const { data, error } = await supabase
    .from("analyst_notes")
    .update({ content: body.content.trim() })
    .eq("id", params.id)
    .eq("user_id", user.id)
    .select("*")
    .maybeSingle();
  if (error) return fail(error.message, 500);
  if (!data) return fail("Not found or not yours", 404);

  return ok({ note: toNotes([data as DbNote])[0] });
}

// DELETE /api/notes/[id] — delete own note.
export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const guard = requireBackend();
  if (guard) return guard;

  const supabase = createClient();
  const user = await getSessionUser(supabase);
  if (!user) return fail("Unauthorized", 401);

  const { error } = await supabase
    .from("analyst_notes")
    .delete()
    .eq("id", params.id)
    .eq("user_id", user.id);
  if (error) return fail(error.message, 500);

  return ok({ ok: true });
}
