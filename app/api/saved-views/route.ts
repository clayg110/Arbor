import { type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { ok, fail, requireBackend, serverError } from "@/lib/api/respond";
import { getSessionUser } from "@/lib/api/auth";
import { parseJson } from "@/lib/validation";
import { validateFilters, type SavedView } from "@/lib/saved-views";
import type { DbSavedView } from "@/types/db";

function toView(row: DbSavedView): SavedView {
  return {
    id: row.id,
    name: row.name,
    filters: validateFilters(row.filters),
    createdAt: row.created_at,
  };
}

const createSchema = z.object({
  name: z.string().trim().min(1).max(100),
  filters: z.record(z.string(), z.unknown()),
});

// GET /api/saved-views — list all saved views for the current user.
export async function GET() {
  const guard = requireBackend();
  if (guard) return guard;
  const supabase = await createClient();
  const user = await getSessionUser(supabase);
  if (!user) return fail("Unauthorized", 401);

  const { data, error } = await supabase
    .from("saved_views")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });
  if (error) return serverError(error);

  const views = ((data ?? []) as DbSavedView[]).map(toView);
  return ok({ views });
}

// POST /api/saved-views — create a new saved view.
export async function POST(request: NextRequest) {
  const guard = requireBackend();
  if (guard) return guard;
  const supabase = await createClient();
  const user = await getSessionUser(supabase);
  if (!user) return fail("Unauthorized", 401);

  const parsed = await parseJson(request, createSchema);
  if (!parsed.ok) return parsed.res;

  let filters: ReturnType<typeof validateFilters>;
  try {
    filters = validateFilters(parsed.data.filters);
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Invalid filters", 400);
  }

  const { data, error } = await supabase
    .from("saved_views")
    .insert({
      user_id: user.id,
      name: parsed.data.name,
      filters: filters as Record<string, unknown>,
    })
    .select("*")
    .single();
  if (error) return serverError(error);

  return ok({ view: toView(data as DbSavedView) }, { status: 201 });
}

// DELETE /api/saved-views?id=… — delete a saved view (must belong to current user).
export async function DELETE(request: NextRequest) {
  const guard = requireBackend();
  if (guard) return guard;
  const supabase = await createClient();
  const user = await getSessionUser(supabase);
  if (!user) return fail("Unauthorized", 401);

  const id = request.nextUrl.searchParams.get("id");
  if (!id) return fail("id required", 400);

  const { error } = await supabase
    .from("saved_views")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) return serverError(error);

  return ok({ ok: true });
}
