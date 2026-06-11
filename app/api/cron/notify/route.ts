import { type NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceClient, hasSupabaseEnv } from "@/lib/supabase/server";
import { ok, fail } from "@/lib/api/respond";
import { safeEqual } from "@/lib/security";
import { buildUserDigests, briefingEmail, type BriefingFrequency } from "@/lib/digest";
import {
  recentStageChanges,
  createNotifications,
  upsertNotificationRows,
} from "@/lib/notifications";
import {
  matchRule,
  alertNotificationRows,
  describeEvent,
  toAlertRule,
  type AlertEvent,
} from "@/lib/alert-rules";
import { computeConviction } from "@/lib/conviction";
import { daysSince } from "@/lib/adapters/time";
import { sendAllAlerts } from "@/lib/alerts";
import { sendEmail, hasEmailEnv } from "@/lib/email";
import { log } from "@/lib/logger";
import type { Database, DbAlertRule, ConvictionRow, DbUserPreferences } from "@/types/db";
import type { Sector, DealType, Stage, Confidence } from "@/lib/types";

type SvcClient = SupabaseClient<Database>;

// Shape returned by the deal_stage_history → companies join.
interface HistJoin {
  company_id: string;
  event_type: string | null;
  changed_at: string;
  company: {
    id: string;
    name: string;
    sector: Sector;
    deal_type: DealType;
    sponsor_firm: string | null;
    parent_company: string | null;
    confidence: Confidence;
    current_stage: Stage;
  } | null;
}

// Evaluate active alert rules against stage changes in the window. In-app
// notifications always; webhook posts when the rule opts in (and ALERT_WEBHOOK is
// set — sendAlert is a no-op otherwise). Returns the count of new notifications.
async function runAlertRules(svc: SvcClient, cutoff: string): Promise<number> {
  const { data: ruleRows } = await svc.from("alert_rules").select("*").eq("active", true);
  const rules = ((ruleRows ?? []) as DbAlertRule[]).map(toAlertRule);
  if (rules.length === 0) return 0;

  const { data: histRows } = await svc
    .from("deal_stage_history")
    .select(
      "company_id,event_type,changed_at," +
        "company:companies(id,name,sector,deal_type,sponsor_firm,parent_company,confidence,current_stage)"
    )
    .gte("changed_at", cutoff)
    .order("changed_at", { ascending: false })
    .limit(1000);
  const hist = (histRows ?? []) as unknown as HistJoin[];
  const ids = [...new Set(hist.map((h) => h.company_id))];
  if (ids.length === 0) return 0;

  const [{ data: convRows }, { data: lastRows }] = await Promise.all([
    svc.from("v_company_conviction").select("*").in("company_id", ids),
    svc
      .from("v_company_last_signal")
      .select("company_id,ingested_at")
      .in("company_id", ids),
  ]);
  const convMap = new Map<string, ConvictionRow>();
  for (const r of (convRows ?? []) as ConvictionRow[]) convMap.set(r.company_id, r);
  const lastMap = new Map<string, string>();
  for (const r of (lastRows ?? []) as { company_id: string; ingested_at: string }[]) {
    lastMap.set(r.company_id, r.ingested_at);
  }

  const events: AlertEvent[] = hist.flatMap((h) => {
    const c = h.company;
    if (!c) return [];
    const last = lastMap.get(h.company_id);
    const conv = convMap.get(h.company_id);
    const score = computeConviction({
      lastSignalAgeDays: last ? daysSince(last) : 99999,
      confidence: c.confidence,
      stage: c.current_stage,
      signalCount30d: conv?.signal_count_30d,
      distinctSourceTypes: conv?.distinct_source_types,
    }).score;
    return [
      {
        companyId: c.id,
        companyName: c.name,
        eventType: h.event_type ?? "updated",
        stage: c.current_stage,
        sector: c.sector,
        dealType: c.deal_type,
        sponsor: c.sponsor_firm ?? c.parent_company ?? null,
        confidence: c.confidence,
        convictionScore: score,
        at: h.changed_at,
      },
    ];
  });

  const matches: { rule: (typeof rules)[number]; event: AlertEvent }[] = [];
  for (const event of events) {
    for (const rule of rules) {
      if (matchRule(rule, event)) matches.push({ rule, event });
    }
  }
  if (matches.length === 0) return 0;

  const created = await upsertNotificationRows(svc, alertNotificationRows(matches));

  // Best-effort webhook fan-out for opted-in rules (no-op without ALERT_WEBHOOK).
  await Promise.all(
    matches
      .filter((m) => m.rule.webhook)
      .map((m) =>
        sendAllAlerts(
          `Alert "${m.rule.name}": ${m.event.companyName} ${describeEvent(m.event.eventType)}`
        )
      )
  );

  // Per-rule email delivery (no-op without RESEND_API_KEY).
  if (hasEmailEnv()) {
    await Promise.all(
      matches
        .filter((m) => m.rule.emailDelivery)
        .map(async (m) => {
          try {
            const { data: userData } = await svc.auth.admin.getUserById(m.rule.userId);
            const email = userData?.user?.email;
            if (!email) return;
            const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.arbor.ai";
            const companyUrl = `${appUrl}/company/${m.event.companyId}`;
            await sendEmail({
              to: email,
              subject: `Arbor alert: ${m.event.companyName} — ${m.rule.name}`,
              html: `<p style="font-family:sans-serif;font-size:14px;color:#2b2a26">
                <strong>${m.event.companyName}</strong> ${describeEvent(m.event.eventType)} and matched your alert <em>${m.rule.name}</em>.
                <br><br>
                <a href="${companyUrl}" style="color:#185FA5">View company →</a>
              </p>`,
            });
          } catch {
            // per-user failures are non-fatal
          }
        })
    );
  }

  return created;
}

// Send briefing emails to opted-in users. Returns count of emails sent.
// Dormant unless RESEND_API_KEY + EMAIL_FROM are set.
async function sendBriefingEmails(
  svc: SvcClient,
  digests: {
    userId: string;
    items: ReturnType<typeof buildUserDigests>[number]["items"];
  }[]
): Promise<number> {
  if (!hasEmailEnv() || digests.length === 0) return 0;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.arbor.ai";

  // Fetch preferences for users with digest items.
  const userIds = digests.map((d) => d.userId);
  const { data: prefRows } = await svc
    .from("user_preferences")
    .select("user_id,briefing_frequency")
    .in("user_id", userIds)
    .neq("briefing_frequency", "off");
  const prefsMap = new Map<string, BriefingFrequency>();
  for (const r of (prefRows ?? []) as Pick<
    DbUserPreferences,
    "user_id" | "briefing_frequency"
  >[]) {
    prefsMap.set(r.user_id, r.briefing_frequency);
  }
  if (prefsMap.size === 0) return 0;

  // Weekly briefings only send on Monday (day 1).
  const isMonday = new Date().getDay() === 1;

  const toSend = digests.filter((d) => {
    const f = prefsMap.get(d.userId);
    if (!f || f === "off") return false;
    if (f === "weekly" && !isMonday) return false;
    return true;
  });
  if (toSend.length === 0) return 0;

  // Fetch emails for opted-in users via auth.admin.
  let sent = 0;
  await Promise.all(
    toSend.map(async (d) => {
      try {
        const { data: userData } = await svc.auth.admin.getUserById(d.userId);
        const email = userData?.user?.email;
        if (!email) return;
        const freq = prefsMap.get(d.userId) ?? "daily";
        const { subject, html } = briefingEmail({
          items: d.items,
          frequency: freq,
          appUrl,
        });
        const result = await sendEmail({ to: email, subject, html });
        if (result.ok) sent++;
      } catch {
        // per-user failures are non-fatal
      }
    })
  );

  return sent;
}

// GET /api/cron/notify — in-app notifications for watchlist activity + custom
// alert rules. Guarded by CRON_SECRET. Idempotent (dedupe_key), safe to run often.
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

  const [changes, alerts] = await Promise.all([
    recentStageChanges(svc, cutoff),
    runAlertRules(svc, cutoff),
  ]);
  if (changes.length === 0) return ok({ ok: true, created: 0, recipients: 0, alerts });

  const { data: wl } = await svc.from("watchlist").select("user_id,company_id");
  const digests = buildUserDigests(
    changes,
    (wl ?? []) as { user_id: string; company_id: string }[]
  );
  const [created, emailed] = await Promise.all([
    createNotifications(svc, digests),
    sendBriefingEmails(svc, digests),
  ]);

  log.info("notify cron", { created, recipients: digests.length, alerts, emailed });
  return ok({ ok: true, created, recipients: digests.length, alerts, emailed });
}
