import { type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { ok, fail, requireBackend, serverError } from "@/lib/api/respond";
import { getSessionUser } from "@/lib/api/auth";
import { parseJson } from "@/lib/validation";
import { toFund } from "@/lib/adapters";
import type { DbFund } from "@/types/db";

const currentYear = new Date().getUTCFullYear();

const createSchema = z.object({
  name: z.string().trim().min(1).max(200),
  vintageYear: z
    .number()
    .int()
    .min(1900)
    .max(currentYear + 20)
    .nullish(),
});

// GET /api/funds — fund directory with deal counts.
export async function GET() {
  const guard = requireBackend();
  if (guard) return guard;
  const supabase = await createClient();
  const user = await getSessionUser(supabase);
  if (!user) return fail("Unauthorized", 401);

  const [{ data: funds, error }, { data: companies }] = await Promise.all([
    supabase.from("funds").select("*").order("vintage_year", {
      ascending: false,
      nullsFirst: false,
    }),
    supabase.from("companies").select("fund_id"),
  ]);
  if (error) return serverError(error);

  const counts = new Map<string, number>();
  for (const c of (companies ?? []) as { fund_id: string | null }[]) {
    if (c.fund_id) counts.set(c.fund_id, (counts.get(c.fund_id) ?? 0) + 1);
  }

  return ok({
    funds: ((funds ?? []) as DbFund[]).map((f) => ({
      ...toFund(f),
      dealCount: counts.get(f.id) ?? 0,
    })),
  });
}

// POST /api/funds — create a fund.
export async function POST(req: NextRequest) {
  const guard = requireBackend();
  if (guard) return guard;
  const supabase = await createClient();
  const user = await getSessionUser(supabase);
  if (!user) return fail("Unauthorized", 401);

  const parsed = await parseJson(req, createSchema);
  if (!parsed.ok) return parsed.res;
  const d = parsed.data;

  const { data, error } = await supabase
    .from("funds")
    .insert({
      org_id: user.orgId ?? null,
      created_by: user.id,
      name: d.name,
      vintage_year: d.vintageYear ?? null,
    })
    .select("*")
    .single();
  if (error) return serverError(error);

  return ok({ fund: { ...toFund(data as DbFund), dealCount: 0 } }, { status: 201 });
}
