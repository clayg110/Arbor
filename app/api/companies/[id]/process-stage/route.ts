import { type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { ok, fail, requireBackend, serverError } from "@/lib/api/respond";
import { getSessionUser } from "@/lib/api/auth";
import { parseJson } from "@/lib/validation";
import type { DbProcessHistory } from "@/types/db";
import {
  PROCESS_STAGES,
  type OurProcessStage,
  type ProcessHistoryEntry,
} from "@/lib/process-stage";

function toEntry(row: DbProcessHistory): ProcessHistoryEntry {
  return {
    id: row.id,
    companyId: row.company_id,
    userId: row.user_id,
    stage: row.stage,
    notes: row.notes,
    changedAt: row.changed_at,
    authorName: "Team member",
  };
}

const patchSchema = z.object({
  stage: z.enum(PROCESS_STAGES as [OurProcessStage, ...OurProcessStage[]]).nullable(),
  notes: z.string().trim().max(500).optional(),
});

// GET /api/companies/[id]/process-stage
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

  const [compRes, histRes] = await Promise.all([
    supabase
      .from("companies")
      .select("our_process_stage, process_key_dates")
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("deal_process_history")
      .select("*")
      .eq("company_id", id)
      .order("changed_at", { ascending: false }),
  ]);

  if (compRes.error) return serverError(compRes.error);
  if (histRes.error) return serverError(histRes.error);
  if (!compRes.data) return fail("Not found", 404);

  const comp = compRes.data as {
    our_process_stage: OurProcessStage | null;
    process_key_dates: Record<string, string> | null;
  };

  return ok({
    stage: comp.our_process_stage,
    keyDates: comp.process_key_dates ?? {},
    history: ((histRes.data ?? []) as DbProcessHistory[]).map(toEntry),
  });
}

// PATCH /api/companies/[id]/process-stage
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

  const { stage, notes } = parsed.data;

  const { error: updateError } = await supabase
    .from("companies")
    .update({ our_process_stage: stage })
    .eq("id", id);
  if (updateError) return serverError(updateError);

  if (stage !== null) {
    const { error: histError } = await supabase.from("deal_process_history").insert({
      company_id: id,
      user_id: user.id,
      org_id: user.orgId ?? null,
      stage,
      notes: notes ?? null,
    });
    if (histError) return serverError(histError);
  }

  return ok({ stage });
}
