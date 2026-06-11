import { type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ok, fail, requireBackend, serverError } from "@/lib/api/respond";
import { getSessionUser } from "@/lib/api/auth";
import { toCompanyProfile, toSignals } from "@/lib/adapters";
import { draftOutreachEmail } from "@/lib/outreach-draft";
import { hasAnthropicEnv } from "@/lib/extract-signal";
import type { DbCompany, DbSignal } from "@/types/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/companies/[id]/draft-outreach — generate a draft outreach email
// to the company's sponsor or parent using Claude. Dormant without key.
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = requireBackend();
  if (guard) return guard;

  const sb = await createClient();
  const user = await getSessionUser(sb);
  if (!user) return fail("Unauthorized", 401);
  const { id } = await params;

  const { data: company, error } = await sb
    .from("companies")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) return serverError(error);
  if (!company) return fail("Not found", 404);

  if (!hasAnthropicEnv()) return ok({ draft: null, configured: false });

  const { data: sigRows } = await sb
    .from("signals_raw")
    .select("*")
    .eq("company_id", id)
    .order("ingested_at", { ascending: false })
    .limit(8);

  const draft = await draftOutreachEmail(
    toCompanyProfile(company as DbCompany),
    toSignals((sigRows ?? []) as DbSignal[])
  );

  return ok({ draft, configured: true });
}
