import { type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { ok, fail, requireBackend, serverError } from "@/lib/api/respond";
import { getSessionUser } from "@/lib/api/auth";
import { parseJson } from "@/lib/validation";
import { aggregateFeedback, type FeedbackVote } from "@/lib/signal-feedback";
import type { DbSignalFeedback } from "@/types/db";

async function readAggregate(
  supabase: Awaited<ReturnType<typeof createClient>>,
  signalId: string,
  userId: string
) {
  const { data, error } = await supabase
    .from("signal_feedback")
    .select("user_id,vote")
    .eq("signal_id", signalId);
  if (error) return { error };
  const rows = (data ?? []) as Pick<DbSignalFeedback, "user_id" | "vote">[];
  const aggregate = aggregateFeedback(rows.map((r) => r.vote as FeedbackVote));
  const myVote = rows.find((r) => r.user_id === userId)?.vote ?? null;
  return { aggregate, myVote };
}

// GET /api/signals/[id]/feedback — vote tally + the caller's current vote.
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

  const res = await readAggregate(supabase, id, user.id);
  if ("error" in res && res.error) return serverError(res.error);
  return ok(res);
}

const postSchema = z.object({ vote: z.enum(["up", "down"]).nullable() });

// POST /api/signals/[id]/feedback — set/clear the caller's vote, return the tally.
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
  const { vote } = parsed.data;

  if (vote === null) {
    const { error } = await supabase
      .from("signal_feedback")
      .delete()
      .eq("signal_id", id)
      .eq("user_id", user.id);
    if (error) return serverError(error);
  } else {
    const { error } = await supabase.from("signal_feedback").upsert(
      {
        signal_id: id,
        user_id: user.id,
        org_id: user.orgId ?? null,
        vote,
      },
      { onConflict: "signal_id,user_id" }
    );
    if (error) return serverError(error);
  }

  const res = await readAggregate(supabase, id, user.id);
  if ("error" in res && res.error) return serverError(res.error);
  return ok(res);
}
