import { type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { ok, fail, requireBackend, serverError, tooMany } from "@/lib/api/respond";
import { getSessionUser } from "@/lib/api/auth";
import { auditAs } from "@/lib/audit";
import { rateLimit } from "@/lib/redis/ratelimit";
import { parseJson } from "@/lib/validation";
import { toNotes } from "@/lib/adapters";
import type { DbNote } from "@/types/db";

const noteSchema = z.object({
  companyId: z.string().min(1).max(64),
  content: z.string().trim().min(1, "required").max(5000),
});

// POST /api/notes — { companyId, content } add an analyst note.
export async function POST(request: NextRequest) {
  const guard = requireBackend();
  if (guard) return guard;

  const supabase = await createClient();
  const user = await getSessionUser(supabase);
  if (!user) return fail("Unauthorized", 401);

  const limit = await rateLimit(user.id, {
    limit: 60,
    window: "1 m",
    prefix: "write:note",
  });
  if (!limit.ok) return tooMany(limit.reset);

  const parsed = await parseJson(request, noteSchema);
  if (!parsed.ok) return parsed.res;
  const body = parsed.data;

  const { data, error } = await supabase
    .from("analyst_notes")
    .insert({
      company_id: body.companyId,
      user_id: user.id,
      org_id: user.orgId,
      author: user.email,
      content: body.content,
    })
    .select("*")
    .single();
  if (error) return serverError(error);

  await auditAs(user, "note.create", {
    entityType: "note",
    entityId: (data as DbNote).id,
    metadata: { companyId: body.companyId },
  });

  return ok({ note: toNotes([data as DbNote])[0] });
}
