import { createClient } from "@/lib/supabase/server";
import { ok, fail, requireBackend, serverError } from "@/lib/api/respond";
import { getSessionUser } from "@/lib/api/auth";
import { topComps, type CompInput } from "@/lib/comps";
import type { DbCompany } from "@/types/db";

// GET /api/radar/suggestions — top-5 companies not in the user's watchlist that
// are most similar to their watched companies. Uses lib/comps.ts scorer.
// Returns [] when the watchlist is empty or no similar companies score >= 30.
export async function GET() {
  const guard = requireBackend();
  if (guard) return guard;
  const supabase = await createClient();
  const user = await getSessionUser(supabase);
  if (!user) return fail("Unauthorized", 401);

  const { data: wl, error: wlErr } = await supabase
    .from("watchlist")
    .select("company_id")
    .eq("user_id", user.id);
  if (wlErr) return serverError(wlErr);

  const watchedIds = new Set((wl ?? []).map((r) => r.company_id as string));
  if (watchedIds.size === 0) return ok({ suggestions: [] });

  const { data, error } = await supabase
    .from("companies")
    .select("id,name,sector,deal_type,current_stage,revenue,ebitda,outcome")
    .limit(500);
  if (error) return serverError(error);

  const all = (data ?? []) as DbCompany[];
  const watched = all.filter((c) => watchedIds.has(c.id));
  const unwatched = all.filter((c) => !watchedIds.has(c.id));

  if (watched.length === 0 || unwatched.length === 0) return ok({ suggestions: [] });

  const toInput = (c: DbCompany): CompInput => ({
    id: c.id,
    name: c.name,
    sector: c.sector,
    dealType: c.deal_type,
    stage: c.current_stage,
    revenue: c.revenue,
    ebitda: c.ebitda,
    outcome: c.outcome,
  });

  const watchedInputs = watched.map(toInput);
  const unwatchedInputs = unwatched.map(toInput);

  // For each watched company, score all unwatched. Track max score per unwatched id.
  const best = new Map<string, { score: number; matchReasons: string[] }>();
  for (const w of watchedInputs) {
    for (const result of topComps(w, unwatchedInputs, unwatchedInputs.length)) {
      const prev = best.get(result.id);
      if (!prev || result.score > prev.score) {
        best.set(result.id, { score: result.score, matchReasons: result.matchReasons });
      }
    }
  }

  const byId = new Map(unwatched.map((c) => [c.id, c]));
  const suggestions = [...best.entries()]
    .sort((a, b) => b[1].score - a[1].score)
    .slice(0, 5)
    .map(([id, { score, matchReasons }]) => {
      const c = byId.get(id)!;
      return {
        id: c.id,
        name: c.name,
        sector: c.sector,
        dealType: c.deal_type,
        stage: c.current_stage,
        score,
        matchReasons,
      };
    });

  return ok({ suggestions });
}
