import { type NextRequest } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { ok, fail, requireBackend, serverError } from "@/lib/api/respond";
import { getSessionUser } from "@/lib/api/auth";
import { toCompanyProfile, toSignals } from "@/lib/adapters";
import { generateMemo, memoSignalsHash } from "@/lib/memo";
import { hasAnthropicEnv } from "@/lib/extract-signal";
import type { DbCompany, DbSignal, DbCompanyMemo } from "@/types/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6";

// POST /api/companies/[id]/memo — generate (or return cached) AI deal brief.
// Cached per company until the signal set changes; dormant (configured:false)
// without ANTHROPIC_API_KEY so the UI can show a "configure" state.
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

  const { data: sigRows } = await sb
    .from("signals_raw")
    .select("*")
    .eq("company_id", id)
    .order("ingested_at", { ascending: false })
    .limit(12);

  const profile = toCompanyProfile(company as DbCompany);
  const signals = toSignals((sigRows ?? []) as DbSignal[]);
  const hash = memoSignalsHash(signals);

  const svc = createServiceClient();
  const { data: cachedRow } = await svc
    .from("company_memos")
    .select("*")
    .eq("company_id", id)
    .maybeSingle();
  const cached = cachedRow as DbCompanyMemo | null;
  if (cached && cached.signals_hash === hash) {
    return ok({
      memo: cached.memo,
      configured: true,
      cached: true,
      generatedAt: cached.generated_at,
    });
  }

  if (!hasAnthropicEnv()) {
    return ok({ memo: null, configured: false, cached: false, generatedAt: null });
  }

  const memo = await generateMemo(profile, signals);
  if (!memo) {
    return ok({ memo: null, configured: false, cached: false, generatedAt: null });
  }

  const generatedAt = new Date().toISOString();
  await svc.from("company_memos").upsert(
    {
      company_id: id,
      memo,
      signals_hash: hash,
      model: MODEL,
      generated_at: generatedAt,
    },
    { onConflict: "company_id" }
  );

  return ok({ memo, configured: true, cached: false, generatedAt });
}
