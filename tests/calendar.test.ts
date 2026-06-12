import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  escapeIcsText,
  foldLine,
  toIcs,
  gatherDealEvents,
  isValidCalendarDate,
  type CalendarEvent,
} from "@/lib/calendar";
import {
  hasCalendarEnv,
  makeCalendarToken,
  verifyCalendarToken,
} from "@/lib/calendar-token";

const NOW = new Date("2026-06-12T09:00:00Z");

describe("escapeIcsText", () => {
  it("escapes backslash, semicolon, comma, newline per RFC 5545", () => {
    expect(escapeIcsText("a;b,c\\d")).toBe("a\\;b\\,c\\\\d");
    expect(escapeIcsText("line1\nline2")).toBe("line1\\nline2");
    expect(escapeIcsText("crlf\r\nx")).toBe("crlf\\nx");
  });
});

describe("foldLine", () => {
  it("leaves short lines untouched", () => {
    expect(foldLine("SUMMARY:hi")).toBe("SUMMARY:hi");
  });
  it("folds long lines at 75 octets with a leading space continuation", () => {
    const long = "SUMMARY:" + "x".repeat(100);
    const folded = foldLine(long);
    const parts = folded.split("\r\n");
    expect(parts.length).toBeGreaterThan(1);
    expect(Buffer.from(parts[0]!, "utf8").length).toBe(75);
    expect(parts[1]!.startsWith(" ")).toBe(true);
    // unfolding (drop CRLF + leading space) restores the original
    expect(folded.replace(/\r\n /g, "")).toBe(long);
  });
});

describe("toIcs", () => {
  const events: CalendarEvent[] = [
    {
      uid: "task-1@arbor",
      date: "2026-06-20",
      title: "Acme: Send NDA",
      description: "Deal task due",
      category: "task",
    },
  ];

  it("wraps events in a VCALENDAR with VERSION + PRODID", () => {
    const ics = toIcs(events, { now: NOW });
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("VERSION:2.0");
    expect(ics).toContain("PRODID:-//Arbor//Deal Calendar//EN");
    expect(ics).toContain("END:VCALENDAR");
    expect(ics.endsWith("\r\n")).toBe(true);
  });

  it("emits an all-day VEVENT with DTEND on the next day", () => {
    const ics = toIcs(events, { now: NOW });
    expect(ics).toContain("BEGIN:VEVENT");
    expect(ics).toContain("UID:task-1@arbor");
    expect(ics).toContain("DTSTART;VALUE=DATE:20260620");
    expect(ics).toContain("DTEND;VALUE=DATE:20260621");
    expect(ics).toContain("SUMMARY:Acme: Send NDA");
    expect(ics).toContain("DTSTAMP:20260612T090000Z");
  });

  it("uses CRLF line endings", () => {
    expect(toIcs(events, { now: NOW })).toContain("\r\n");
  });

  it("omits DESCRIPTION when absent", () => {
    const ics = toIcs([{ ...events[0]!, description: undefined }], { now: NOW });
    expect(ics).not.toContain("DESCRIPTION:");
  });
});

describe("gatherDealEvents", () => {
  const base = {
    tasks: [
      {
        id: "t1",
        title: "Send NDA",
        dueAt: "2026-06-20T00:00:00Z",
        completedAt: null,
        companyName: "Acme",
      },
      {
        id: "t2",
        title: "Done already",
        dueAt: "2026-06-01T00:00:00Z",
        completedAt: "2026-06-02T00:00:00Z",
        companyName: "Acme",
      },
      {
        id: "t3",
        title: "No date",
        dueAt: null,
        completedAt: null,
        companyName: "Acme",
      },
    ],
    milestones: [
      { companyId: "c1", companyName: "Acme", stage: "first_round", date: "2026-06-15" },
    ],
    bids: [
      {
        id: "b1",
        companyName: "Acme",
        bidType: "indicative" as const,
        round: "1" as const,
        date: "2026-06-10",
      },
    ],
  };

  it("skips completed and dateless tasks", () => {
    const ev = gatherDealEvents(base);
    const taskUids = ev.filter((e) => e.category === "task").map((e) => e.uid);
    expect(taskUids).toEqual(["task-t1@arbor"]);
  });

  it("maps milestones with the stage label", () => {
    const ev = gatherDealEvents(base);
    const m = ev.find((e) => e.category === "milestone");
    expect(m?.uid).toBe("milestone-c1-first_round@arbor");
    expect(m?.title).toContain("Acme:");
  });

  it("maps bids with round + type", () => {
    const ev = gatherDealEvents(base);
    const b = ev.find((e) => e.category === "bid");
    expect(b?.uid).toBe("bid-b1@arbor");
    expect(b?.title).toContain("Indicative bid (Round 1)");
  });

  it("sorts events chronologically", () => {
    const ev = gatherDealEvents(base);
    const dates = ev.map((e) => e.date);
    expect(dates).toEqual([...dates].sort());
  });

  it("skips rows with a malformed or impossible date instead of emitting them", () => {
    const ev = gatherDealEvents({
      tasks: [
        {
          id: "t1",
          title: "ok",
          dueAt: "2026-06-20",
          completedAt: null,
          companyName: "A",
        },
        {
          id: "t2",
          title: "garbage",
          dueAt: "not-a-date",
          completedAt: null,
          companyName: "A",
        },
        {
          id: "t3",
          title: "overflow",
          dueAt: "2026-02-30",
          completedAt: null,
          companyName: "A",
        },
      ],
      milestones: [
        { companyId: "c1", companyName: "A", stage: "nda_signed", date: "2026-13-01" },
      ],
      bids: [
        {
          id: "b1",
          companyName: "A",
          bidType: "final" as const,
          round: "final" as const,
          date: "",
        },
      ],
    });
    expect(ev.map((e) => e.uid)).toEqual(["task-t1@arbor"]);
  });

  it("normalizes ISO datetimes to the date part", () => {
    const ev = gatherDealEvents({
      tasks: [
        {
          id: "t1",
          title: "x",
          dueAt: "2026-06-20T14:30:00Z",
          completedAt: null,
          companyName: "A",
        },
      ],
      milestones: [],
      bids: [],
    });
    expect(ev[0]!.date).toBe("2026-06-20");
    // and the feed serializes without throwing
    expect(() => toIcs(ev, { now: NOW })).not.toThrow();
  });
});

describe("isValidCalendarDate", () => {
  it("accepts real YYYY-MM-DD and ISO datetimes", () => {
    expect(isValidCalendarDate("2026-06-20")).toBe(true);
    expect(isValidCalendarDate("2026-06-20T09:00:00Z")).toBe(true);
    expect(isValidCalendarDate("2024-02-29")).toBe(true); // leap day
  });
  it("rejects malformed, impossible, or empty values", () => {
    expect(isValidCalendarDate("")).toBe(false);
    expect(isValidCalendarDate(null)).toBe(false);
    expect(isValidCalendarDate(undefined)).toBe(false);
    expect(isValidCalendarDate("not-a-date")).toBe(false);
    expect(isValidCalendarDate("2026-13-01")).toBe(false); // month 13
    expect(isValidCalendarDate("2026-02-30")).toBe(false); // overflow
    expect(isValidCalendarDate("2025-02-29")).toBe(false); // non-leap
    expect(isValidCalendarDate("06/20/2026")).toBe(false);
  });
});

describe("calendar-token", () => {
  beforeEach(() => {
    process.env.CALENDAR_FEED_SECRET = "test-secret-123";
  });
  afterEach(() => {
    delete process.env.CALENDAR_FEED_SECRET;
  });

  it("hasCalendarEnv reflects the secret", () => {
    expect(hasCalendarEnv()).toBe(true);
    delete process.env.CALENDAR_FEED_SECRET;
    expect(hasCalendarEnv()).toBe(false);
  });

  it("round-trips a userId", () => {
    const token = makeCalendarToken("user-abc");
    expect(verifyCalendarToken(token)).toBe("user-abc");
  });

  it("rejects a forged MAC", () => {
    const token = makeCalendarToken("user-abc");
    const forged = token.slice(0, token.lastIndexOf(".")) + ".deadbeef";
    expect(verifyCalendarToken(forged)).toBeNull();
  });

  it("rejects a tampered payload", () => {
    const token = makeCalendarToken("user-abc");
    const mac = token.slice(token.lastIndexOf(".") + 1);
    const otherPayload = Buffer.from("user-xyz").toString("base64url");
    expect(verifyCalendarToken(`${otherPayload}.${mac}`)).toBeNull();
  });

  it("rejects malformed tokens", () => {
    expect(verifyCalendarToken("nodot")).toBeNull();
    expect(verifyCalendarToken(".abc")).toBeNull();
  });

  it("returns null when dormant", () => {
    const token = makeCalendarToken("user-abc");
    delete process.env.CALENDAR_FEED_SECRET;
    expect(verifyCalendarToken(token)).toBeNull();
  });
});
