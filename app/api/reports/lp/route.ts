import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ok, fail, requireBackend, serverError } from "@/lib/api/respond";
import { getSessionUser } from "@/lib/api/auth";
import { toFund } from "@/lib/adapters";
import {
  buildLpReport,
  currentQuarter,
  parseQuarter,
  lpReportToCsv,
  type LpDeal,
  type LpFund,
} from "@/lib/lp-report";
import { computeConviction } from "@/lib/conviction";
import type { DbCompany, DbFund, ConvictionRow } from "@/types/db";

// GET /api/reports/lp?quarter=2026-Q2&format=csv
// Quarterly LP snapshot: pipeline grouped by fund (vintage) × sector. `format=csv`
// streams the flattened download; otherwise returns the structured report JSON.
export async function GET(req: NextRequest) {
  const guard = requireBackend();
  if (guard) return guard;
  const supabase = await createClient();
  const user = await getSessionUser(supabase);
  if (!user) return fail("Unauthorized", 401);

  const quarter = req.nextUrl.searchParams.get("quarter") ?? currentQuarter();
  if (!parseQuarter(quarter)) {
    return fail("Invalid quarter (expected e.g. 2026-Q2)", 400);
  }
  const format = req.nextUrl.searchParams.get("format");

  const [
    { data: companies, error: cErr },
    { data: funds },
    { data: convRows },
    { data: bids },
  ] = await Promise.all([
    supabase
      .from("companies")
      .select("id,name,sector,current_stage,confidence,fund_id,created_at"),
    supabase.from("funds").select("*"),
    supabase.from("v_company_conviction").select("*"),
    supabase.from("deal_bids").select("company_id"),
  ]);
  if (cErr) return serverError(cErr);

  const convByCompany = new Map<string, ConvictionRow>();
  for (const r of (convRows ?? []) as ConvictionRow[]) convByCompany.set(r.company_id, r);

  const bidCounts = new Map<string, number>();
  for (const b of (bids ?? []) as { company_id: string }[]) {
    bidCounts.set(b.company_id, (bidCounts.get(b.company_id) ?? 0) + 1);
  }

  const now = Date.now();
  const deals: LpDeal[] = (
    (companies ?? []) as Pick<
      DbCompany,
      "id" | "name" | "sector" | "current_stage" | "confidence" | "fund_id" | "created_at"
    >[]
  ).map((c) => {
    const cv = convByCompany.get(c.id);
    const ageDays = cv?.last_signal_at
      ? Math.floor((now - new Date(cv.last_signal_at).getTime()) / 86_400_000)
      : 99999;
    const conviction = computeConviction({
      lastSignalAgeDays: ageDays,
      confidence: c.confidence,
      stage: c.current_stage,
      signalCount30d: cv?.signal_count_30d,
      distinctSourceTypes: cv?.distinct_source_types,
    }).score;
    return {
      companyId: c.id,
      companyName: c.name,
      sector: c.sector,
      fundId: c.fund_id ?? null,
      stage: c.current_stage,
      conviction,
      bidCount: bidCounts.get(c.id) ?? 0,
      createdAt: c.created_at,
    };
  });

  const lpFunds: LpFund[] = ((funds ?? []) as DbFund[]).map(toFund);
  const report = buildLpReport(deals, lpFunds, quarter);

  if (format === "csv") {
    return new NextResponse(lpReportToCsv(report), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="arbor-lp-${quarter}.csv"`,
      },
    });
  }

  return ok({ report });
}
