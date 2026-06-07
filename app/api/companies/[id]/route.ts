import { type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ok, fail, requireBackend, serverError } from "@/lib/api/respond";
import { getSessionUser } from "@/lib/api/auth";
import { auditAs } from "@/lib/audit";
import {
  toCompanyProfile,
  toStageHistory,
  toSignals,
  toNotes,
} from "@/lib/adapters";
import type { DbCompany, DbHistory, DbSignal, DbNote } from "@/types/db";
import type { Stage, Confidence } from "@/lib/types";

// GET /api/companies/[id] — full profile bundle.
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const guard = requireBackend();
  if (guard) return guard;

  const supabase = createClient();
  const { id } = params;

  const { data: company, error } = await supabase
    .from("companies")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) return serverError(error);
  if (!company) return fail("Not found", 404);
  const c = company as DbCompany;

  const [{ data: history }, { data: signals }, { data: notes }, { data: peers }, { data: wl }] =
    await Promise.all([
      supabase.from("deal_stage_history").select("*").eq("company_id", id).order("changed_at", { ascending: false }),
      supabase.from("signals_raw").select("*").eq("company_id", id).order("ingested_at", { ascending: false }).limit(8),
      supabase.from("analyst_notes").select("*").eq("company_id", id).order("created_at", { ascending: false }),
      supabase.from("companies").select("*").eq("sector", c.sector).neq("id", id).limit(4),
      supabase.from("watchlist").select("id").eq("company_id", id).maybeSingle(),
    ]);

  return ok({
    company: toCompanyProfile(c),
    history: toStageHistory((history ?? []) as DbHistory[]),
    signals: toSignals((signals ?? []) as DbSignal[]),
    notes: toNotes((notes ?? []) as DbNote[]),
    peers: ((peers ?? []) as DbCompany[]).map(toCompanyProfile),
    watched: !!wl,
  });
}

// PATCH /api/companies/[id] — stage override / confirm / mark-for-review.
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const guard = requireBackend();
  if (guard) return guard;

  const { id } = params;
  let body: { action?: string; stage?: Stage; confidence?: Confidence; notes?: string };
  try {
    body = await request.json();
  } catch {
    return fail("Invalid JSON body");
  }

  const supabase = createClient();
  const user = await getSessionUser(supabase);
  if (!user) return fail("Unauthorized", 401);

  const action = body.action ?? "override";

  if (action === "override") {
    if (!body.stage) return fail("stage required for override");
    const { data, error } = await supabase.rpc("rpc_apply_stage", {
      p_company_id: id,
      p_stage: body.stage,
      p_confidence: "high",
      p_changed_by: "analyst_manual",
      p_source_type: "manual",
      p_notes: body.notes ?? "Stage overridden by analyst.",
    });
    if (error) return serverError(error);
    await auditAs(user, "company.stage_override", {
      entityType: "company",
      entityId: id,
      metadata: { stage: body.stage, notes: body.notes ?? null },
    });
    return ok({ ok: true, history: data });
  }

  if (action === "confirm") {
    const { error } = await supabase.from("companies").update({ confidence: "high" }).eq("id", id);
    if (error) return serverError(error);
    await auditAs(user, "company.confirm", { entityType: "company", entityId: id });
    return ok({ ok: true });
  }

  if (action === "mark_review") {
    const { error } = await supabase.from("companies").update({ confidence: "needs_review" }).eq("id", id);
    if (error) return serverError(error);
    await auditAs(user, "company.mark_review", { entityType: "company", entityId: id });
    return ok({ ok: true });
  }

  return fail("Unknown action");
}
