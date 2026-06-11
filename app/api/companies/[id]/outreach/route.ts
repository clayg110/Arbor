import { type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { ok, fail, requireBackend, serverError } from "@/lib/api/respond";
import { getSessionUser } from "@/lib/api/auth";
import { parseJson } from "@/lib/validation";
import type { OutreachEntry } from "@/lib/deal-tasks";
import type { DbOutreachLog } from "@/types/db";

const OUTREACH_TYPES = ["call", "email", "meeting", "other"] as const;

function toEntry(row: DbOutreachLog, authorName: string): OutreachEntry {
  return {
    id: row.id,
    companyId: row.company_id,
    userId: row.user_id,
    authorName,
    type: row.type,
    note: row.note,
    contactedAt: row.contacted_at,
    createdAt: row.created_at,
  };
}

const createSchema = z.object({
  type: z.enum(OUTREACH_TYPES),
  note: z.string().trim().min(1).max(2000),
  contactedAt: z.string().datetime({ offset: true }).optional(),
});

// GET /api/companies/[id]/outreach
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
    .from("outreach_log")
    .select("*")
    .eq("company_id", id)
    .order("contacted_at", { ascending: false });
  if (error) return serverError(error);

  const entries = ((data ?? []) as DbOutreachLog[]).map((r) => toEntry(r, "Team member"));
  return ok({ entries });
}

// POST /api/companies/[id]/outreach
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
    .from("outreach_log")
    .insert({
      company_id: id,
      user_id: user.id,
      type: parsed.data.type,
      note: parsed.data.note,
      contacted_at: parsed.data.contactedAt ?? new Date().toISOString(),
    })
    .select("*")
    .single();
  if (error) return serverError(error);

  return ok({ entry: toEntry(data as DbOutreachLog, "You") }, { status: 201 });
}

// DELETE /api/companies/[id]/outreach?entryId=…
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = requireBackend();
  if (guard) return guard;
  await params;
  const entryId = req.nextUrl.searchParams.get("entryId");
  if (!entryId) return fail("entryId required", 400);

  const supabase = await createClient();
  const user = await getSessionUser(supabase);
  if (!user) return fail("Unauthorized", 401);

  const { error } = await supabase
    .from("outreach_log")
    .delete()
    .eq("id", entryId)
    .eq("user_id", user.id);
  if (error) return serverError(error);

  return ok({ ok: true });
}
