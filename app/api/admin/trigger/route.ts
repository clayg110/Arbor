import { type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ok, fail, requireBackend } from "@/lib/api/respond";
import { getSessionUser } from "@/lib/api/auth";

const PIPELINES: Record<string, string> = {
  carveouts: "/api/ingest/carveouts",
  "private-assets": "/api/ingest/private-assets",
};

// POST /api/admin/trigger?pipeline=carveouts — admin-only manual run.
// Forwards to the cron-guarded ingest route with the CRON_SECRET (server-side).
export async function POST(request: NextRequest) {
  const guard = requireBackend();
  if (guard) return guard;

  const supabase = await createClient();
  const user = await getSessionUser(supabase);
  if (!user) return fail("Unauthorized", 401);
  if (user.role !== "admin") return fail("Forbidden", 403);

  const pipeline = request.nextUrl.searchParams.get("pipeline") ?? "";
  const path = PIPELINES[pipeline];
  if (!path) return fail("Unknown pipeline");

  const headers: Record<string, string> = {};
  if (process.env.CRON_SECRET)
    headers.authorization = `Bearer ${process.env.CRON_SECRET}`;

  const res = await fetch(`${request.nextUrl.origin}${path}`, {
    method: "POST",
    headers,
  });
  const result = await res.json().catch(() => ({}));
  return ok({ pipeline, status: res.status, result }, { status: res.ok ? 200 : 502 });
}
