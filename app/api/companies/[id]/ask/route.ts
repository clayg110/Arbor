import { type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { ok, fail, requireBackend, serverError } from "@/lib/api/respond";
import { getSessionUser } from "@/lib/api/auth";
import { parseJson } from "@/lib/validation";
import { toCompanyProfile, toSignals } from "@/lib/adapters";
import { answerQuestionWithCitations } from "@/lib/memo";
import { hasAnthropicEnv } from "@/lib/extract-signal";
import type { DbCompany, DbSignal } from "@/types/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const askSchema = z.object({ question: z.string().trim().min(3).max(500) });

// POST /api/companies/[id]/ask — answer an analyst question grounded only in the
// company's facts + stored signals. Dormant (configured:false) without a key.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = requireBackend();
  if (guard) return guard;

  const sb = await createClient();
  const user = await getSessionUser(sb);
  if (!user) return fail("Unauthorized", 401);
  const { id } = await params;

  const parsed = await parseJson(request, askSchema);
  if (!parsed.ok) return parsed.res;

  const { data: company, error } = await sb
    .from("companies")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) return serverError(error);
  if (!company) return fail("Not found", 404);

  const { data: sigRows } = await sb
    .from("signals_raw")
    .select("*")
    .eq("company_id", id)
    .order("ingested_at", { ascending: false })
    .limit(12);

  if (!hasAnthropicEnv()) return ok({ answer: null, citations: [], configured: false });

  const result = await answerQuestionWithCitations(
    toCompanyProfile(company as DbCompany),
    toSignals((sigRows ?? []) as DbSignal[]),
    parsed.data.question
  );

  return ok(result);
}
