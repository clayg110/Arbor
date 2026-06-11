import { type NextRequest } from "next/server";
import { createServiceClient, hasSupabaseEnv } from "@/lib/supabase/server";
import { ok, fail } from "@/lib/api/respond";
import { safeEqual } from "@/lib/security";
import { sendEmail, hasEmailEnv } from "@/lib/email";
import { buildReportEmail, type ReportFrequency } from "@/lib/report";
import { toRadarCompany } from "@/lib/adapters/company";
import { log } from "@/lib/logger";
import type { Database, DbCompany, DbUserPreferences } from "@/types/db";
import type { SupabaseClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

type SvcClient = SupabaseClient<Database>;

// GET /api/cron/report — send scheduled pipeline reports to opted-in users.
// Weekly reports fire every Monday; monthly fire on the 1st. Both are no-ops
// without RESEND_API_KEY. Guarded by CRON_SECRET.
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization") ?? "";
    if (!safeEqual(auth, `Bearer ${secret}`)) return fail("Unauthorized", 401);
  }
  if (!hasSupabaseEnv()) return fail("Backend not configured", 503);
  if (!hasEmailEnv()) return ok({ ok: true, sent: 0, reason: "email-not-configured" });

  const today = new Date();
  const isMonday = today.getDay() === 1;
  const isFirstOfMonth = today.getDate() === 1;

  const svc = createServiceClient();
  const sent = await sendReports(svc, isMonday, isFirstOfMonth);
  log.info("report cron", { sent });
  return ok({ ok: true, sent });
}

async function sendReports(
  svc: SvcClient,
  isMonday: boolean,
  isFirstOfMonth: boolean
): Promise<number> {
  // Fetch opted-in users.
  const { data: prefRows } = await svc
    .from("user_preferences")
    .select("user_id,report_frequency")
    .neq("report_frequency", "off");

  const prefs = (prefRows ?? []) as Pick<
    DbUserPreferences,
    "user_id" | "report_frequency"
  >[];
  const toSend = prefs.filter((p) => {
    const f = p.report_frequency as ReportFrequency;
    if (f === "weekly" && !isMonday) return false;
    if (f === "monthly" && !isFirstOfMonth) return false;
    return true;
  });
  if (toSend.length === 0) return 0;

  // Fetch all companies once (shared across all recipients).
  const { data: companyRows } = await svc
    .from("companies")
    .select("*")
    .not("current_stage", "eq", "pulled")
    .order("updated_at", { ascending: false })
    .limit(500);
  const companies = ((companyRows ?? []) as DbCompany[]).map((c) => toRadarCompany(c));
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.arbor.ai";

  let sent = 0;
  await Promise.all(
    toSend.map(async (p) => {
      try {
        const { data: userData } = await svc.auth.admin.getUserById(p.user_id);
        const email = userData?.user?.email;
        if (!email) return;
        const freq = p.report_frequency as ReportFrequency;
        const { subject, html } = buildReportEmail(companies, appUrl, freq);
        const result = await sendEmail({ to: email, subject, html });
        if (result.ok) sent++;
      } catch {
        // per-user failures non-fatal
      }
    })
  );

  return sent;
}
