import { type NextRequest } from "next/server";
import { createServiceClient, hasSupabaseEnv } from "@/lib/supabase/server";
import { ok, fail } from "@/lib/api/respond";
import { safeEqual } from "@/lib/security";
import { purgeExpired } from "@/lib/retention";
import { log } from "@/lib/logger";

// GET /api/cron/retention — data-retention purge (Vercel cron). Guarded by
// CRON_SECRET. Prunes expired operational rows + orphaned raw signals.
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization") ?? "";
    if (!safeEqual(auth, `Bearer ${secret}`)) return fail("Unauthorized", 401);
  }
  if (!hasSupabaseEnv()) return fail("Backend not configured", 503);

  const purged = await purgeExpired(createServiceClient());
  log.info("retention purge", purged);
  return ok({ ok: true, purged });
}
