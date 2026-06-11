import { type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { ok, fail, requireBackend, serverError } from "@/lib/api/respond";
import { getSessionUser } from "@/lib/api/auth";
import { parseJson } from "@/lib/validation";
import { toContact } from "@/lib/adapters";
import type { DbContact } from "@/types/db";

const patchSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  title: z.string().trim().max(200).nullish(),
  firm: z.string().trim().max(200).nullish(),
  email: z.string().trim().max(320).nullish(),
  phone: z.string().trim().max(50).nullish(),
  linkedinUrl: z.string().trim().max(500).nullish(),
  notes: z.string().trim().max(2000).nullish(),
});

// PATCH /api/contacts/[id] — edit a contact.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = requireBackend();
  if (guard) return guard;
  const { id } = await params;
  const supabase = await createClient();
  const user = await getSessionUser(supabase);
  if (!user) return fail("Unauthorized", 401);

  const parsed = await parseJson(req, patchSchema);
  if (!parsed.ok) return parsed.res;
  const d = parsed.data;

  const update: Partial<DbContact> = {};
  if (d.name !== undefined) update.name = d.name;
  if (d.title !== undefined) update.title = d.title ?? null;
  if (d.firm !== undefined) update.firm = d.firm ?? null;
  if (d.email !== undefined) update.email = d.email ?? null;
  if (d.phone !== undefined) update.phone = d.phone ?? null;
  if (d.linkedinUrl !== undefined) update.linkedin_url = d.linkedinUrl ?? null;
  if (d.notes !== undefined) update.notes = d.notes ?? null;
  if (Object.keys(update).length === 0) return fail("No fields to update", 400);

  const { data, error } = await supabase
    .from("contacts")
    .update(update)
    .eq("id", id)
    .select("*")
    .maybeSingle();
  if (error) return serverError(error);
  if (!data) return fail("Not found", 404);

  return ok({ contact: toContact(data as DbContact) });
}

// DELETE /api/contacts/[id] — remove a contact (cascades its company links).
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = requireBackend();
  if (guard) return guard;
  const { id } = await params;
  const supabase = await createClient();
  const user = await getSessionUser(supabase);
  if (!user) return fail("Unauthorized", 401);

  const { error } = await supabase.from("contacts").delete().eq("id", id);
  if (error) return serverError(error);

  return ok({ ok: true });
}
