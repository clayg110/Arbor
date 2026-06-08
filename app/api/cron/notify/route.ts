import { type NextRequest } from "next/server";
import { createServiceClient, hasSupabaseEnv } from "@/lib/supabase/server";
import { ok, fail } from "@/lib/api/respond";
import { safeEqual } from "@/lib/security";
import { buildUserDigests } from "@/lib/digest";
import { recentStageChanges, createNotifications } from "@/lib/notifications";
import { log } from "@/lib/logger";

// GET /api/cron/notify — writes in-app notifications for watchlist activity.
// Guarded by CRON_SECRET. Idempotent (dedupe_key), so it can run frequently.
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization") ?? "";
    if (!safeEqual(auth, `Bearer ${secret}`)) return fail("Unauthorized", 401);
  }
  if (!hasSupabaseEnv()) return fail("Backend not configured", 503);

  const hours = Number(process.env.DIGEST_WINDOW_HOURS ?? 24);
  const cutoff = new Date(Date.now() - hours * 3_600_000).toISOString();
  const svc = createServiceClient();

  const changes = await recentStageChanges(svc, cutoff);
  if (changes.length === 0) return ok({ ok: true, created: 0, recipients: 0 });

  const { data: wl } = await svc.from("watchlist").select("user_id,company_id");
  const digests = buildUserDigests(
    changes,
    (wl ?? []) as { user_id: string; company_id: string }[]
  );
  const created = await createNotifications(svc, digests);

  log.info("notify cron", { created, recipients: digests.length });
  return ok({ ok: true, created, recipients: digests.length });
}
