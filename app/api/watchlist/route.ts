import { type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ok, fail, requireBackend, serverError } from "@/lib/api/respond";
import { getSessionUser } from "@/lib/api/auth";
import { toRadarCompany } from "@/lib/adapters";
import type { DbCompany } from "@/types/db";

// GET /api/watchlist — the current user's watched company ids + full company
// rows (for the /watchlist manage page). RLS scopes rows to the current user.
export async function GET() {
  const guard = requireBackend();
  if (guard) return guard;
  const supabase = createClient();
  const { data, error } = await supabase
    .from("watchlist")
    .select("company_id, company:companies(*)")
    .order("created_at", { ascending: false });
  if (error) return serverError(error);

  const rows = (data ?? []) as unknown as {
    company_id: string;
    company: DbCompany | null;
  }[];

  const ids = rows.map((r) => r.company_id);
  const companies = rows
    .filter((r) => r.company)
    .map((r) => toRadarCompany(r.company!, null, true));

  return ok({ ids, companies });
}

// POST /api/watchlist — { companyId } add.
export async function POST(request: NextRequest) {
  const guard = requireBackend();
  if (guard) return guard;
  const supabase = createClient();
  const user = await getSessionUser(supabase);
  if (!user) return fail("Unauthorized", 401);

  let body: { companyId?: string };
  try {
    body = await request.json();
  } catch {
    return fail("Invalid JSON body");
  }
  if (!body.companyId) return fail("companyId required");

  const { error } = await supabase
    .from("watchlist")
    .upsert(
      { user_id: user.id, company_id: body.companyId, org_id: user.orgId },
      { onConflict: "user_id,company_id" }
    );
  if (error) return serverError(error);
  return ok({ ok: true, watched: true });
}

// DELETE /api/watchlist?companyId= remove.
export async function DELETE(request: NextRequest) {
  const guard = requireBackend();
  if (guard) return guard;
  const supabase = createClient();
  const user = await getSessionUser(supabase);
  if (!user) return fail("Unauthorized", 401);

  const companyId = request.nextUrl.searchParams.get("companyId");
  if (!companyId) return fail("companyId required");

  const { error } = await supabase
    .from("watchlist")
    .delete()
    .eq("user_id", user.id)
    .eq("company_id", companyId);
  if (error) return serverError(error);
  return ok({ ok: true, watched: false });
}
