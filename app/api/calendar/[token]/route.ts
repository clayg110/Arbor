import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { verifyCalendarToken } from "@/lib/calendar-token";
import {
  gatherDealEvents,
  toIcs,
  type CalendarMilestoneRow,
  type CalendarTaskRow,
  type CalendarBidRow,
} from "@/lib/calendar";
import type { DbCompany, DbDealTask, DbBid } from "@/types/db";

// GET /api/calendar/[token].ics — a user's deal dates as an iCalendar feed.
// No session: calendar apps poll a bare URL. Security = the signed token, which
// resolves to a userId; we then read that user's rows with the service client.
// 404 (not 401) when dormant or token invalid, so the feed is indistinguishable
// from a non-existent path to anyone probing.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  // Tolerate the conventional ".ics" suffix on the subscription URL.
  const raw = token.endsWith(".ics") ? token.slice(0, -4) : token;
  const userId = verifyCalendarToken(raw);
  if (!userId) return new NextResponse("Not found", { status: 404 });

  const sb = createServiceClient();

  const [tasksRes, companiesRes, bidsRes] = await Promise.all([
    sb
      .from("deal_tasks")
      .select("id,title,due_at,completed_at,company_id")
      .eq("user_id", userId)
      .not("due_at", "is", null)
      .is("completed_at", null),
    sb
      .from("companies")
      .select("id,name,our_process_stage,process_key_dates")
      .eq("owner_id", userId)
      .not("our_process_stage", "is", null),
    sb
      .from("deal_bids")
      .select("id,bid_type,round,bid_date,company_id")
      .eq("user_id", userId),
  ]);

  const companies = (companiesRes.data ?? []) as Pick<
    DbCompany,
    "id" | "name" | "our_process_stage" | "process_key_dates"
  >[];
  const taskRows = (tasksRes.data ?? []) as Pick<
    DbDealTask,
    "id" | "title" | "due_at" | "completed_at" | "company_id"
  >[];
  const bidRows = (bidsRes.data ?? []) as Pick<
    DbBid,
    "id" | "bid_type" | "round" | "bid_date" | "company_id"
  >[];

  const nameById = new Map(companies.map((c) => [c.id, c.name]));

  // Tasks/bids may reference companies the user doesn't own (so they're absent
  // from the milestone query above). Resolve those names so events read as
  // "Company: …" rather than a generic "Deal".
  const referenced = [...taskRows, ...bidRows].map((r) => r.company_id);
  const missingIds = [...new Set(referenced)].filter((id) => id && !nameById.has(id));
  if (missingIds.length > 0) {
    const { data: extra } = await sb
      .from("companies")
      .select("id,name")
      .in("id", missingIds);
    for (const c of (extra ?? []) as { id: string; name: string }[]) {
      nameById.set(c.id, c.name);
    }
  }

  const tasks: CalendarTaskRow[] = taskRows.map((t) => ({
    id: t.id,
    title: t.title,
    dueAt: t.due_at,
    completedAt: t.completed_at,
    companyName: nameById.get(t.company_id) ?? "Deal",
  }));

  const milestones: CalendarMilestoneRow[] = [];
  for (const c of companies) {
    const keyDates = c.process_key_dates ?? {};
    for (const [stage, date] of Object.entries(keyDates)) {
      if (!date) continue;
      milestones.push({
        companyId: c.id,
        companyName: c.name,
        stage,
        date,
      });
    }
  }

  const bids: CalendarBidRow[] = bidRows.map((b) => ({
    id: b.id,
    bidType: b.bid_type,
    round: b.round,
    date: b.bid_date,
    companyName: nameById.get(b.company_id) ?? "Deal",
  }));

  const ics = toIcs(gatherDealEvents({ tasks, milestones, bids }));

  return new NextResponse(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="arbor-deals.ics"',
      // Calendar clients poll periodically; let them cache briefly.
      "Cache-Control": "private, max-age=300",
    },
  });
}
