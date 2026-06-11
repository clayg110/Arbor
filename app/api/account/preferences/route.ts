import { type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { ok, fail, requireBackend, serverError } from "@/lib/api/respond";
import { getSessionUser } from "@/lib/api/auth";
import { parseJson } from "@/lib/validation";
import type { DbUserPreferences } from "@/types/db";

const patchSchema = z.object({
  briefingFrequency: z.enum(["off", "daily", "weekly"]).optional(),
  reportFrequency: z.enum(["off", "weekly", "monthly"]).optional(),
});

// GET /api/account/preferences — current user's preferences (defaults if unset).
export async function GET() {
  const guard = requireBackend();
  if (guard) return guard;
  const supabase = await createClient();
  const user = await getSessionUser(supabase);
  if (!user) return fail("Unauthorized", 401);

  const { data, error } = await supabase
    .from("user_preferences")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) return serverError(error);

  const row = data as DbUserPreferences | null;
  return ok({
    briefingFrequency: row?.briefing_frequency ?? "off",
    reportFrequency: row?.report_frequency ?? "off",
  });
}

// PATCH /api/account/preferences — update preferences (upsert).
export async function PATCH(request: NextRequest) {
  const guard = requireBackend();
  if (guard) return guard;
  const supabase = await createClient();
  const user = await getSessionUser(supabase);
  if (!user) return fail("Unauthorized", 401);

  const parsed = await parseJson(request, patchSchema);
  if (!parsed.ok) return parsed.res;
  const { briefingFrequency, reportFrequency } = parsed.data;

  const updates: Record<string, string> = { updated_at: new Date().toISOString() };
  if (briefingFrequency !== undefined) updates.briefing_frequency = briefingFrequency;
  if (reportFrequency !== undefined) updates.report_frequency = reportFrequency;

  if (Object.keys(updates).length > 1) {
    const { error } = await supabase
      .from("user_preferences")
      .upsert({ user_id: user.id, ...updates }, { onConflict: "user_id" });
    if (error) return serverError(error);
  }

  return ok({ ok: true });
}
