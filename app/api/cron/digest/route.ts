import { type NextRequest } from "next/server";
import { createServiceClient, hasSupabaseEnv } from "@/lib/supabase/server";
import { ok, fail } from "@/lib/api/respond";
import { safeEqual } from "@/lib/security";
import { buildUserDigests, digestEmail } from "@/lib/digest";
import { recentStageChanges } from "@/lib/notifications";
import { hasEmailEnv, sendEmail } from "@/lib/email";
import { log } from "@/lib/logger";

// GET /api/cron/digest — daily watchlist digest (Vercel cron). Guarded by
// CRON_SECRET; no-op when email is unconfigured. Emails each user the recent
// activity on companies they watch.
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization") ?? "";
    if (!safeEqual(auth, `Bearer ${secret}`)) return fail("Unauthorized", 401);
  }
  if (!hasSupabaseEnv()) return fail("Backend not configured", 503);
  if (!hasEmailEnv()) return ok({ ok: true, skipped: "email_unconfigured" });

  const hours = Number(process.env.DIGEST_WINDOW_HOURS ?? 24);
  const cutoff = new Date(Date.now() - hours * 3_600_000).toISOString();
  const svc = createServiceClient();

  const changes = await recentStageChanges(svc, cutoff);
  if (changes.length === 0) return ok({ ok: true, changes: 0, recipients: 0, sent: 0 });

  const { data: wl } = await svc.from("watchlist").select("user_id,company_id");
  const digests = buildUserDigests(
    changes,
    (wl ?? []) as { user_id: string; company_id: string }[]
  );
  if (digests.length === 0)
    return ok({ ok: true, changes: changes.length, recipients: 0, sent: 0 });

  const { data: list } = await svc.auth.admin.listUsers();
  const emailById = new Map((list?.users ?? []).map((u) => [u.id, u.email]));
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? request.nextUrl.origin;

  let sent = 0;
  for (const d of digests.slice(0, 500)) {
    const to = emailById.get(d.userId);
    if (!to) continue;
    const mail = digestEmail({ items: d.items, appUrl });
    const r = await sendEmail({ to, ...mail });
    if (r.ok) sent++;
  }

  log.info("watchlist digest", {
    changes: changes.length,
    recipients: digests.length,
    sent,
  });
  return ok({ ok: true, changes: changes.length, recipients: digests.length, sent });
}
