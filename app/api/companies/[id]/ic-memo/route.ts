import { type NextRequest } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { ok, fail, requireBackend, serverError } from "@/lib/api/respond";
import { getSessionUser } from "@/lib/api/auth";
import { toCompanyProfile, toSignals } from "@/lib/adapters";
import { generateIcMemo, icMemoHash, parseIcMemo } from "@/lib/ic-memo";
import { topComps, type CompInput } from "@/lib/comps";
import { hasAnthropicEnv } from "@/lib/extract-signal";
import type { DbCompany, DbSignal, DbCompanyIcMemo } from "@/types/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6";

// POST /api/companies/[id]/ic-memo — generate (or return cached) structured IC
// memo. Cached per company until signals / process stage / comp set change.
// Dormant (configured:false) without ANTHROPIC_API_KEY.
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
  const c = company as DbCompany;

  const [{ data: sigRows }, { data: compCands }] = await Promise.all([
    sb
      .from("signals_raw")
      .select("*")
      .eq("company_id", id)
      .order("ingested_at", { ascending: false })
      .limit(12),
    sb
      .from("companies")
      .select("id,name,sector,deal_type,current_stage,revenue,ebitda,outcome")
      .or(`sector.eq.${c.sector},deal_type.eq.${c.deal_type}`)
      .neq("id", id)
      .limit(80),
  ]);

  const profile = toCompanyProfile(c);
  const signals = toSignals((sigRows ?? []) as DbSignal[]);
  const processStage = c.our_process_stage ?? null;

  const target: CompInput = {
    id: c.id,
    name: c.name,
    sector: c.sector,
    dealType: c.deal_type,
    stage: c.current_stage,
    revenue: c.revenue,
    ebitda: c.ebitda,
    outcome: c.outcome,
  };
  const comps = topComps(
    target,
    ((compCands ?? []) as DbCompany[]).map((r) => ({
      id: r.id,
      name: r.name,
      sector: r.sector,
      dealType: r.deal_type,
      stage: r.current_stage,
      revenue: r.revenue,
      ebitda: r.ebitda,
      outcome: r.outcome,
    }))
  );

  const hash = icMemoHash(signals, processStage, comps);

  const svc = createServiceClient();
  const { data: cachedRow } = await svc
    .from("company_ic_memos")
    .select("*")
    .eq("company_id", id)
    .maybeSingle();
  const cached = cachedRow as DbCompanyIcMemo | null;
  if (cached && cached.signals_hash === hash) {
    return ok({
      sections: parseIcMemo(cached.memo),
      configured: true,
      cached: true,
      generatedAt: cached.generated_at,
    });
  }

  if (!hasAnthropicEnv()) {
    return ok({ sections: null, configured: false, cached: false, generatedAt: null });
  }

  const memo = await generateIcMemo(profile, signals, processStage, comps);
  if (!memo) {
    return ok({ sections: null, configured: true, cached: false, generatedAt: null });
  }

  const generatedAt = new Date().toISOString();
  await svc.from("company_ic_memos").upsert(
    {
      company_id: id,
      memo,
      signals_hash: hash,
      model: MODEL,
      generated_at: generatedAt,
    },
    { onConflict: "company_id" }
  );

  return ok({
    sections: parseIcMemo(memo),
    configured: true,
    cached: false,
    generatedAt,
  });
}
