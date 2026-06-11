import { type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { ok, fail, requireBackend, serverError } from "@/lib/api/respond";
import { getSessionUser } from "@/lib/api/auth";
import { parseJson } from "@/lib/validation";
import type { DealTask } from "@/lib/deal-tasks";
import type { DbDealTask } from "@/types/db";

function toTask(row: DbDealTask): DealTask {
  return {
    id: row.id,
    companyId: row.company_id,
    userId: row.user_id,
    title: row.title,
    dueAt: row.due_at,
    completedAt: row.completed_at,
    createdAt: row.created_at,
  };
}

const createSchema = z.object({
  title: z.string().trim().min(1).max(500),
  dueAt: z.string().datetime({ offset: true }).nullable().optional(),
});

const patchSchema = z.object({
  completed: z.boolean().optional(),
  title: z.string().trim().min(1).max(500).optional(),
  dueAt: z.string().datetime({ offset: true }).nullable().optional(),
});

// GET /api/companies/[id]/tasks
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = requireBackend();
  if (guard) return guard;
  const { id } = await params;
  const supabase = await createClient();
  const user = await getSessionUser(supabase);
  if (!user) return fail("Unauthorized", 401);

  const { data, error } = await supabase
    .from("deal_tasks")
    .select("*")
    .eq("company_id", id)
    .order("created_at", { ascending: true });
  if (error) return serverError(error);

  return ok({ tasks: ((data ?? []) as DbDealTask[]).map(toTask) });
}

// POST /api/companies/[id]/tasks
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = requireBackend();
  if (guard) return guard;
  const { id } = await params;
  const supabase = await createClient();
  const user = await getSessionUser(supabase);
  if (!user) return fail("Unauthorized", 401);

  const parsed = await parseJson(req, createSchema);
  if (!parsed.ok) return parsed.res;

  const { data, error } = await supabase
    .from("deal_tasks")
    .insert({
      company_id: id,
      user_id: user.id,
      title: parsed.data.title,
      due_at: parsed.data.dueAt ?? null,
    })
    .select("*")
    .single();
  if (error) return serverError(error);

  return ok({ task: toTask(data as DbDealTask) }, { status: 201 });
}

// PATCH /api/companies/[id]/tasks?taskId=…
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = requireBackend();
  if (guard) return guard;
  await params;
  const taskId = req.nextUrl.searchParams.get("taskId");
  if (!taskId) return fail("taskId required", 400);

  const supabase = await createClient();
  const user = await getSessionUser(supabase);
  if (!user) return fail("Unauthorized", 401);

  const parsed = await parseJson(req, patchSchema);
  if (!parsed.ok) return parsed.res;

  const updates: {
    title?: string;
    due_at?: string | null;
    completed_at?: string | null;
  } = {};
  if (parsed.data.title !== undefined) updates.title = parsed.data.title;
  if (parsed.data.dueAt !== undefined) updates.due_at = parsed.data.dueAt;
  if (parsed.data.completed !== undefined) {
    updates.completed_at = parsed.data.completed ? new Date().toISOString() : null;
  }

  const { data, error } = await supabase
    .from("deal_tasks")
    .update(updates)
    .eq("id", taskId)
    .eq("user_id", user.id)
    .select("*")
    .single();
  if (error) return serverError(error);
  if (!data) return fail("Not found", 404);

  return ok({ task: toTask(data as DbDealTask) });
}

// DELETE /api/companies/[id]/tasks?taskId=…
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = requireBackend();
  if (guard) return guard;
  await params;
  const taskId = req.nextUrl.searchParams.get("taskId");
  if (!taskId) return fail("taskId required", 400);

  const supabase = await createClient();
  const user = await getSessionUser(supabase);
  if (!user) return fail("Unauthorized", 401);

  const { error } = await supabase
    .from("deal_tasks")
    .delete()
    .eq("id", taskId)
    .eq("user_id", user.id);
  if (error) return serverError(error);

  return ok({ ok: true });
}
