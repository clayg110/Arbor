// Pure iCalendar (RFC 5545) builder for the deal-calendar subscription feed.
// No I/O. The feed route fetches a user's deal dates, maps them to CalendarEvent
// via `gatherDealEvents`, and serializes with `toIcs`. Calendar apps (Google,
// Outlook, Apple) poll the feed URL and render the VEVENTs as all-day entries.

import { PROCESS_STAGE_LABELS, type OurProcessStage } from "@/lib/process-stage";

export type CalendarCategory = "task" | "milestone" | "bid";

export interface CalendarEvent {
  uid: string; // globally-stable per row so re-polls update in place, not duplicate
  date: string; // YYYY-MM-DD (all-day)
  title: string;
  description?: string;
  category: CalendarCategory;
}

// ---- serialization ------------------------------------------------------

// RFC 5545 §3.3.11: escape backslash, semicolon, comma, and newlines in TEXT.
export function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r\n|\n|\r/g, "\\n");
}

// RFC 5545 §3.1: content lines are folded at 75 octets; continuation lines
// begin with a single space. We fold on byte length (UTF-8), not char count.
export function foldLine(line: string): string {
  const bytes = Buffer.from(line, "utf8");
  if (bytes.length <= 75) return line;
  const parts: string[] = [];
  let start = 0;
  // First chunk 75 octets, subsequent 74 (the leading space costs one octet).
  let limit = 75;
  while (start < bytes.length) {
    let end = Math.min(start + limit, bytes.length);
    // Don't split a multi-byte UTF-8 sequence: back off until `end` starts a char.
    while (end < bytes.length && (bytes[end]! & 0xc0) === 0x80) end--;
    const chunk = bytes.subarray(start, end).toString("utf8");
    parts.push(start === 0 ? chunk : " " + chunk);
    start = end;
    limit = 74;
  }
  return parts.join("\r\n");
}

// YYYY-MM-DD → YYYYMMDD (DATE value). Accepts ISO datetimes too (takes the date).
function icsDate(date: string): string {
  return date.slice(0, 10).replace(/-/g, "");
}

// DATE one day after `date` (exclusive DTEND for an all-day event).
function nextDay(date: string): string {
  const d = new Date(date.slice(0, 10) + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10).replace(/-/g, "");
}

export interface IcsOptions {
  calName?: string;
  // Stamp for DTSTAMP; injectable so tests are deterministic.
  now?: Date;
}

export function toIcs(events: readonly CalendarEvent[], opts: IcsOptions = {}): string {
  const calName = opts.calName ?? "Arbor Deal Calendar";
  const dtstamp = toIcsStamp(opts.now ?? new Date());

  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Arbor//Deal Calendar//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    foldLine("X-WR-CALNAME:" + escapeIcsText(calName)),
  ];

  for (const ev of events) {
    lines.push("BEGIN:VEVENT");
    lines.push("UID:" + ev.uid);
    lines.push("DTSTAMP:" + dtstamp);
    lines.push("DTSTART;VALUE=DATE:" + icsDate(ev.date));
    lines.push("DTEND;VALUE=DATE:" + nextDay(ev.date));
    lines.push(foldLine("SUMMARY:" + escapeIcsText(ev.title)));
    if (ev.description) {
      lines.push(foldLine("DESCRIPTION:" + escapeIcsText(ev.description)));
    }
    lines.push("CATEGORIES:" + ev.category.toUpperCase());
    lines.push("TRANSP:TRANSPARENT");
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");
  return lines.join("\r\n") + "\r\n";
}

// UTC basic-format timestamp: 20260612T090000Z.
function toIcsStamp(d: Date): string {
  return (
    d.getUTCFullYear().toString().padStart(4, "0") +
    (d.getUTCMonth() + 1).toString().padStart(2, "0") +
    d.getUTCDate().toString().padStart(2, "0") +
    "T" +
    d.getUTCHours().toString().padStart(2, "0") +
    d.getUTCMinutes().toString().padStart(2, "0") +
    d.getUTCSeconds().toString().padStart(2, "0") +
    "Z"
  );
}

// ---- domain → events ----------------------------------------------------

export interface CalendarTaskRow {
  id: string;
  title: string;
  dueAt: string | null;
  companyName: string;
  completedAt: string | null;
}

export interface CalendarMilestoneRow {
  companyId: string;
  companyName: string;
  stage: string; // OurProcessStage key
  date: string; // YYYY-MM-DD
}

export interface CalendarBidRow {
  id: string;
  companyName: string;
  bidType: "indicative" | "final";
  round: "1" | "2" | "final";
  date: string; // YYYY-MM-DD
}

export interface DealCalendarInput {
  tasks: readonly CalendarTaskRow[];
  milestones: readonly CalendarMilestoneRow[];
  bids: readonly CalendarBidRow[];
}

// Map a user's deal rows to all-day calendar events. Skips dateless/completed
// tasks. UIDs are deterministic per source row so a re-poll updates in place.
export function gatherDealEvents(input: DealCalendarInput): CalendarEvent[] {
  const events: CalendarEvent[] = [];

  for (const t of input.tasks) {
    if (!t.dueAt || t.completedAt) continue;
    events.push({
      uid: `task-${t.id}@arbor`,
      date: t.dueAt,
      title: `${t.companyName}: ${t.title}`,
      description: "Deal task due",
      category: "task",
    });
  }

  for (const m of input.milestones) {
    const label = PROCESS_STAGE_LABELS[m.stage as OurProcessStage] ?? m.stage;
    events.push({
      uid: `milestone-${m.companyId}-${m.stage}@arbor`,
      date: m.date,
      title: `${m.companyName}: ${label}`,
      description: "Process milestone",
      category: "milestone",
    });
  }

  for (const b of input.bids) {
    const round = b.round === "final" ? "Final" : `Round ${b.round}`;
    events.push({
      uid: `bid-${b.id}@arbor`,
      date: b.date,
      title: `${b.companyName}: ${b.bidType === "final" ? "Final" : "Indicative"} bid (${round})`,
      description: "Bid / offer date",
      category: "bid",
    });
  }

  // Stable chronological order so the feed is diff-friendly between polls.
  events.sort((a, b) =>
    a.date < b.date ? -1 : a.date > b.date ? 1 : a.uid < b.uid ? -1 : 1
  );
  return events;
}
