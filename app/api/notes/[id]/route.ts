import { type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { ok, fail, requireBackend, serverError } from "@/lib/api/respond";
import { getSessionUser } from "@/lib/api/auth";
import { parseJson } from "@/lib/validation";
import { toNotes } from "@/lib/adapters";
import type { DbNote } from "@/types/db";

const editSchema = z.object({ content: z.string().trim().min(1, "required").max(5000) });

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

  const parsed = await parseJson(request, editSchema);
  if (!parsed.ok) return parsed.res;

  const { data, error } = await supabase
    .from("analyst_notes")
    .update({ content: parsed.data.content })
    .eq("id", params.id)
    .eq("user_id", user.id)
    .select("*")
    .maybeSingle();
  if (error) return serverError(error);
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
  if (error) return serverError(error);

  return ok({ ok: true });
}
