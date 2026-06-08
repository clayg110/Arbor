import { createClient } from "@/lib/supabase/server";
import { fail, requireBackend, serverError } from "@/lib/api/respond";
import { getSessionUser } from "@/lib/api/auth";
import { NextResponse } from "next/server";

// GET /api/account/export — GDPR/CCPA data portability. Returns the requesting
// user's own personal data (profile + notes + watchlist) as a JSON download.
export async function GET() {
  const guard = requireBackend();
  if (guard) return guard;

  const supabase = await createClient();
  const user = await getSessionUser(supabase);
  if (!user) return fail("Unauthorized", 401);

  const [notes, watch] = await Promise.all([
    supabase
      .from("analyst_notes")
      .select("id, company_id, content, created_at")
      .eq("user_id", user.id),
    supabase.from("watchlist").select("company_id, created_at").eq("user_id", user.id),
  ]);
  if (notes.error) return serverError(notes.error);
  if (watch.error) return serverError(watch.error);

  const payload = {
    exportedAt: new Date().toISOString(),
    profile: { id: user.id, email: user.email, role: user.role, orgId: user.orgId },
    notes: notes.data ?? [],
    watchlist: watch.data ?? [],
  };

  return new NextResponse(JSON.stringify(payload, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="arbor-export-${user.id}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
