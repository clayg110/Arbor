import { createClient, createServiceClient } from "@/lib/supabase/server";
import { ok, fail, requireBackend, serverError } from "@/lib/api/respond";
import { getSessionUser } from "@/lib/api/auth";
import type { DbCompany, DbProcessHistory, DbBid } from "@/types/db";
import type { OurProcessStage, ProcessKeyDates } from "@/lib/process-stage";
import { avgMultiple } from "@/lib/bids";
import type { PipelineDeal } from "@/lib/pipeline";
import type { Bid } from "@/lib/bids";

// GET /api/pipeline
export async function GET() {
  const guard = requireBackend();
  if (guard) return guard;
  const supabase = await createClient();
  const user = await getSessionUser(supabase);
  if (!user) return fail("Unauthorized", 401);

  // 1. Companies with a process stage set
  const { data: companies, error: cErr } = await supabase
    .from("companies")
    .select(
      "id,name,sector,deal_type,our_process_stage,process_key_dates,owner_id,org_id"
    )
    .not("our_process_stage", "is", null)
    .order("updated_at", { ascending: false });

  if (cErr) return serverError(cErr);
  const rows = (companies ?? []) as Pick<
    DbCompany,
    | "id"
    | "name"
    | "sector"
    | "deal_type"
    | "our_process_stage"
    | "process_key_dates"
    | "owner_id"
    | "org_id"
  >[];

  if (rows.length === 0) return ok({ deals: [] as PipelineDeal[] });

  const companyIds = rows.map((r) => r.id);

  // 2. Latest history entry per company (to compute daysInStage)
  const { data: history, error: hErr } = await supabase
    .from("deal_process_history")
    .select("company_id,changed_at")
    .in("company_id", companyIds)
    .order("changed_at", { ascending: false });
  if (hErr) return serverError(hErr);

  const latestChange = new Map<string, string>();
  for (const h of (history ?? []) as Pick<
    DbProcessHistory,
    "company_id" | "changed_at"
  >[]) {
    if (!latestChange.has(h.company_id)) latestChange.set(h.company_id, h.changed_at);
  }

  // 3. Bid stats per company
  const { data: bids, error: bErr } = await supabase
    .from("deal_bids")
    .select("company_id,multiple_on_ebitda")
    .in("company_id", companyIds);
  if (bErr) return serverError(bErr);

  const bidsByCompany = new Map<string, Pick<DbBid, "multiple_on_ebitda">[]>();
  for (const b of (bids ?? []) as Pick<DbBid, "company_id" | "multiple_on_ebitda">[]) {
    const existing = bidsByCompany.get(b.company_id) ?? [];
    existing.push(b);
    bidsByCompany.set(b.company_id, existing);
  }

  // 4. Owner emails (best-effort — skip if service client unavailable)
  const ownerEmailMap = new Map<string, string>();
  const ownerIds = [...new Set(rows.map((r) => r.owner_id).filter(Boolean))] as string[];
  if (ownerIds.length > 0) {
    try {
      const svc = createServiceClient();
      const { data } = await svc.auth.admin.listUsers({ perPage: 500 });
      for (const u of data?.users ?? []) {
        if (u.email) ownerEmailMap.set(u.id, u.email);
      }
    } catch {
      // fail open — display ownerId initials instead
    }
  }

  const now = Date.now();
  const deals: PipelineDeal[] = rows.map((r) => {
    const changedAt = latestChange.get(r.id);
    const daysInStage = changedAt
      ? Math.floor((now - new Date(changedAt).getTime()) / 86_400_000)
      : 0;
    const companyBids = bidsByCompany.get(r.id) ?? [];
    const mockBids: Bid[] = companyBids.map((b, i) => ({
      id: `${r.id}-${i}`,
      companyId: r.id,
      userId: "",
      orgId: null,
      bidType: "indicative",
      round: "1",
      bidDate: "",
      amountUsd: null,
      multipleOnEbitda: b.multiple_on_ebitda,
      rationale: null,
      createdAt: "",
    }));
    return {
      companyId: r.id,
      companyName: r.name,
      sector: r.sector,
      dealType: r.deal_type,
      ourProcessStage: r.our_process_stage as OurProcessStage,
      keyDates: (r.process_key_dates as ProcessKeyDates) ?? {},
      daysInStage,
      ownerId: r.owner_id ?? null,
      ownerEmail: r.owner_id ? (ownerEmailMap.get(r.owner_id) ?? null) : null,
      bidCount: companyBids.length,
      avgBidMultiple: avgMultiple(mockBids),
    };
  });

  return ok({ deals });
}
