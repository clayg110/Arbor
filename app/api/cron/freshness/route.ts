import { type NextRequest } from "next/server";
import { createServiceClient, hasSupabaseEnv } from "@/lib/supabase/server";
import { ok, fail } from "@/lib/api/respond";
import { safeEqual } from "@/lib/security";
import { checkFreshness } from "@/lib/freshness";
import { sendAlert } from "@/lib/alerts";

// GET /api/cron/freshness — data-freshness SLA probe (Vercel cron).
// Guarded by CRON_SECRET when set. Alerts (Slack webhook) when the newest signal
// is older than FRESHNESS_MAX_HOURS (default 24h), i.e. ingestion has stalled.
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization") ?? "";
    if (!safeEqual(auth, `Bearer ${secret}`)) return fail("Unauthorized", 401);
  }
  if (!hasSupabaseEnv()) return fail("Backend not configured", 503);

  const maxAgeHours = Number(process.env.FRESHNESS_MAX_HOURS ?? 24);
  const f = await checkFreshness(createServiceClient(), maxAgeHours);

  if (f.stale) {
    const age = f.ageHours == null ? "never" : `${f.ageHours}h ago`;
    await sendAlert(
      `⏳ Arbor data is stale — newest signal ${f.lastSignalAt ?? "none"} (${age}, ` +
        `SLA ${maxAgeHours}h). Check the ingestion pipelines.`
    );
  }

  return ok(f);
}
