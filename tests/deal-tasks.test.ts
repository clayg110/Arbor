import { describe, it, expect } from "vitest";
import {
  isOverdue,
  isDueToday,
  formatDue,
  sortTasks,
  parseMentions,
  type DealTask,
} from "@/lib/deal-tasks";

const NOW = new Date("2026-06-11T12:00:00Z");

const base: DealTask = {
  id: "t1",
  companyId: "c1",
  userId: "u1",
  title: "Follow up with advisor",
  dueAt: null,
  completedAt: null,
  createdAt: "2026-06-01T00:00:00Z",
};

describe("isOverdue", () => {
  it("false when no due date", () => {
    expect(isOverdue(base, NOW)).toBe(false);
  });

  it("false when completed", () => {
    expect(
      isOverdue(
        { ...base, dueAt: "2026-06-01T00:00:00Z", completedAt: "2026-06-02T00:00:00Z" },
        NOW
      )
    ).toBe(false);
  });

  it("true when past due and not complete", () => {
    expect(isOverdue({ ...base, dueAt: "2026-06-10T00:00:00Z" }, NOW)).toBe(true);
  });

  it("false when due in the future", () => {
    expect(isOverdue({ ...base, dueAt: "2026-06-20T00:00:00Z" }, NOW)).toBe(false);
  });
});

describe("isDueToday", () => {
  it("true when due same day as now", () => {
    expect(isDueToday({ ...base, dueAt: "2026-06-11T09:00:00Z" }, NOW)).toBe(true);
  });

  it("false when due tomorrow", () => {
    expect(isDueToday({ ...base, dueAt: "2026-06-12T00:00:00Z" }, NOW)).toBe(false);
  });

  it("false when completed even if due today", () => {
    expect(
      isDueToday(
        { ...base, dueAt: "2026-06-11T09:00:00Z", completedAt: "2026-06-11T08:00:00Z" },
        NOW
      )
    ).toBe(false);
  });
});

describe("formatDue", () => {
  it("returns empty string for null", () => {
    expect(formatDue(null, NOW)).toBe("");
  });

  it("Today for same day", () => {
    expect(formatDue("2026-06-11T15:00:00Z", NOW)).toBe("Today");
  });

  it("Tomorrow for next day", () => {
    expect(formatDue("2026-06-12T09:00:00Z", NOW)).toBe("Tomorrow");
  });

  it("Yesterday for previous day", () => {
    expect(formatDue("2026-06-10T09:00:00Z", NOW)).toBe("Yesterday");
  });

  it("Xd overdue for past dates", () => {
    expect(formatDue("2026-06-08T00:00:00Z", NOW)).toMatch(/overdue/);
  });

  it("In Xd for near future", () => {
    expect(formatDue("2026-06-14T00:00:00Z", NOW)).toBe("In 3d");
  });

  it("month/day format for far future", () => {
    const r = formatDue("2026-07-01T00:00:00Z", NOW);
    expect(r).toMatch(/Jul/);
  });
});

describe("sortTasks", () => {
  const overdue: DealTask = { ...base, id: "t-over", dueAt: "2026-06-01T00:00:00Z" };
  const future: DealTask = { ...base, id: "t-fut", dueAt: "2026-06-20T00:00:00Z" };
  const noDue: DealTask = { ...base, id: "t-none" };
  const done: DealTask = { ...base, id: "t-done", completedAt: "2026-06-10T00:00:00Z" };

  it("incomplete before completed", () => {
    const sorted = sortTasks([done, noDue], NOW);
    expect(sorted[0]!.id).toBe("t-none");
    expect(sorted[1]!.id).toBe("t-done");
  });

  it("overdue before future-due", () => {
    const sorted = sortTasks([future, overdue], NOW);
    expect(sorted[0]!.id).toBe("t-over");
  });

  it("due-date ordering among incomplete", () => {
    const early: DealTask = { ...base, id: "t-early", dueAt: "2026-06-15T00:00:00Z" };
    const late: DealTask = { ...base, id: "t-late", dueAt: "2026-06-25T00:00:00Z" };
    const sorted = sortTasks([late, early], NOW);
    expect(sorted[0]!.id).toBe("t-early");
  });

  it("no-due tasks after due-date tasks", () => {
    const sorted = sortTasks([noDue, future], NOW);
    expect(sorted[0]!.id).toBe("t-fut");
    expect(sorted[1]!.id).toBe("t-none");
  });
});

describe("parseMentions", () => {
  it("extracts @mentions", () => {
    expect(parseMentions("Hey @alice please review")).toEqual(["alice"]);
  });

  it("multiple mentions deduplicated", () => {
    expect(parseMentions("@bob @alice @bob")).toEqual(["bob", "alice"]);
  });

  it("lowercases mentions", () => {
    expect(parseMentions("@Alice")).toEqual(["alice"]);
  });

  it("empty when no mentions", () => {
    expect(parseMentions("No mentions here.")).toEqual([]);
  });

  it("does not match bare @ symbols", () => {
    expect(parseMentions("Email me @ the address")).toEqual([]);
  });
});
