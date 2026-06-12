import { type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { ok, fail, requireBackend, serverError } from "@/lib/api/respond";
import { getSessionUser } from "@/lib/api/auth";
import { parseJson } from "@/lib/validation";
import { toFund } from "@/lib/adapters";
import type { DbFund } from "@/types/db";

const currentYear = new Date().getUTCFullYear();

const patchSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  vintageYear: z
    .number()
    .int()
    .min(1900)
    .max(currentYear + 20)
    .nullish(),
});

// PATCH /api/funds/[id] — rename / re-vintage a fund.
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

  const update: Partial<DbFund> = {};
  if (d.name !== undefined) update.name = d.name;
  if (d.vintageYear !== undefined) update.vintage_year = d.vintageYear ?? null;
  if (Object.keys(update).length === 0) return fail("No fields to update", 400);

  const { data, error } = await supabase
    .from("funds")
    .update(update)
    .eq("id", id)
    .select("*")
    .maybeSingle();
  if (error) return serverError(error);
  if (!data) return fail("Not found", 404);

  return ok({ fund: toFund(data as DbFund) });
}

// DELETE /api/funds/[id] — remove a fund. Companies' fund_id is set null by the
// FK (ON DELETE SET NULL), so their deals stay in the pipeline, just unassigned.
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

  const { error } = await supabase.from("funds").delete().eq("id", id);
  if (error) return serverError(error);

  return ok({ ok: true });
}
