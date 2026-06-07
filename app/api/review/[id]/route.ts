import { type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { ok, fail, requireBackend, serverError } from "@/lib/api/respond";
import { getSessionUser } from "@/lib/api/auth";
import { auditAs } from "@/lib/audit";
import { parseJson, stageEnum } from "@/lib/validation";

const reviewSchema = z.object({
  action: z.enum(["confirm", "override"]),
  stage: stageEnum.optional(),
});

// POST /api/review/[id] — { action: "confirm" | "override", stage? }
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const guard = requireBackend();
  if (guard) return guard;

  const supabase = createClient();
  const user = await getSessionUser(supabase);
  if (!user) return fail("Unauthorized", 401);

  const parsed = await parseJson(request, reviewSchema);
  if (!parsed.ok) return parsed.res;
  const body = parsed.data;

  if (body.action === "confirm") {
    const { error } = await supabase
      .from("companies")
      .update({ confidence: "high" })
      .eq("id", params.id);
    if (error) return serverError(error);
    await auditAs(user, "review.confirm", { entityType: "company", entityId: params.id });
    return ok({ ok: true });
  }

  if (body.action === "override") {
    if (!body.stage) return fail("stage required for override");
    const { data, error } = await supabase.rpc("rpc_apply_stage", {
      p_company_id: params.id,
      p_stage: body.stage,
      p_confidence: "high",
      p_changed_by: "analyst_manual",
      p_source_type: "manual",
      p_notes: "Stage overridden from review queue.",
    });
    if (error) return serverError(error);
    await auditAs(user, "review.override", {
      entityType: "company",
      entityId: params.id,
      metadata: { stage: body.stage },
    });
    return ok({ ok: true, history: data });
  }

  return fail("Unknown action");
}
