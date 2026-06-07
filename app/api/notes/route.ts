import { type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ok, fail, requireBackend, serverError } from "@/lib/api/respond";
import { getSessionUser } from "@/lib/api/auth";
import { auditAs } from "@/lib/audit";
import { toNotes } from "@/lib/adapters";
import type { DbNote } from "@/types/db";

// POST /api/notes — { companyId, content } add an analyst note.
export async function POST(request: NextRequest) {
  const guard = requireBackend();
  if (guard) return guard;

  const supabase = createClient();
  const user = await getSessionUser(supabase);
  if (!user) return fail("Unauthorized", 401);

  let body: { companyId?: string; content?: string };
  try {
    body = await request.json();
  } catch {
    return fail("Invalid JSON body");
  }
  if (!body.companyId || !body.content?.trim()) {
    return fail("companyId and content required");
  }

  const { data, error } = await supabase
    .from("analyst_notes")
    .insert({
      company_id: body.companyId,
      user_id: user.id,
      org_id: user.orgId,
      author: user.email,
      content: body.content.trim(),
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
