import { type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ok, fail, requireBackend } from "@/lib/api/respond";
import { getSessionUser } from "@/lib/api/auth";
import type { Stage } from "@/lib/types";

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

  let body: { action?: string; stage?: Stage };
  try {
    body = await request.json();
  } catch {
    return fail("Invalid JSON body");
  }

  if (body.action === "confirm") {
    const { error } = await supabase
      .from("companies")
      .update({ confidence: "high" })
      .eq("id", params.id);
    if (error) return fail(error.message, 500);
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
    if (error) return fail(error.message, 500);
    return ok({ ok: true, history: data });
  }

  return fail("Unknown action");
}
