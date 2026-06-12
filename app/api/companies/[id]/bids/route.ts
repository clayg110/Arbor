import { type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { ok, fail, requireBackend, serverError } from "@/lib/api/respond";
import { getSessionUser } from "@/lib/api/auth";
import { parseJson } from "@/lib/validation";
import { isValidCalendarDate } from "@/lib/calendar";
import type { DbBid } from "@/types/db";
import type { Bid } from "@/lib/bids";

function toBid(row: DbBid): Bid {
  return {
    id: row.id,
    companyId: row.company_id,
    userId: row.user_id,
    orgId: row.org_id,
    bidType: row.bid_type,
    round: row.round,
    bidDate: row.bid_date,
    amountUsd: row.amount_usd,
    multipleOnEbitda: row.multiple_on_ebitda,
    rationale: row.rationale,
    createdAt: row.created_at,
  };
}

const postSchema = z.object({
  bidType: z.enum(["indicative", "final"]),
  round: z.enum(["1", "2", "final"]),
  bidDate: z.string().refine(isValidCalendarDate, "bidDate must be a valid YYYY-MM-DD"),
  amountUsd: z.number().positive().nullable().default(null),
  multipleOnEbitda: z.number().positive().nullable().default(null),
  rationale: z.string().trim().max(1000).nullable().default(null),
});

// GET /api/companies/[id]/bids
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = requireBackend();
  if (guard) return guard;
  const { id } = await params;
  const supabase = await createClient();
  const user = await getSessionUser(supabase);
  if (!user) return fail("Unauthorized", 401);

  const { data, error } = await supabase
    .from("deal_bids")
    .select("*")
    .eq("company_id", id)
    .order("bid_date", { ascending: false });

  if (error) return serverError(error);
  return ok({ bids: ((data ?? []) as DbBid[]).map(toBid) });
}

// POST /api/companies/[id]/bids
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = requireBackend();
  if (guard) return guard;
  const { id } = await params;
  const supabase = await createClient();
  const user = await getSessionUser(supabase);
  if (!user) return fail("Unauthorized", 401);

  const parsed = await parseJson(req, postSchema);
  if (!parsed.ok) return parsed.res;

  const { bidType, round, bidDate, amountUsd, multipleOnEbitda, rationale } = parsed.data;

  const { data, error } = await supabase
    .from("deal_bids")
    .insert({
      company_id: id,
      user_id: user.id,
      org_id: user.orgId ?? null,
      bid_type: bidType,
      round,
      bid_date: bidDate,
      amount_usd: amountUsd,
      multiple_on_ebitda: multipleOnEbitda,
      rationale,
    })
    .select()
    .single();

  if (error) return serverError(error);
  return ok({ bid: toBid(data as DbBid) });
}
