import { describe, it, expect } from "vitest";
import { cn, formatDate, formatTime, dayLabel, daysLabel } from "@/lib/format";

describe("cn", () => {
  it("joins truthy parts and drops falsy", () => {
    expect(cn("a", false, null, undefined, "b")).toBe("a b");
    expect(cn()).toBe("");
  });
});

describe("formatDate", () => {
  it("formats a valid ISO date", () => {
    expect(formatDate("2026-05-31T00:00:00Z")).toMatch(/May/);
  });
  it("passes through an unparseable value", () => {
    expect(formatDate("not-a-date")).toBe("not-a-date");
  });
});

describe("formatTime", () => {
  it("formats a valid ISO time", () => {
    expect(formatTime("2026-05-31T13:05:00")).toMatch(/\d/);
  });
  it("returns empty string on garbage", () => {
    expect(formatTime("nope")).toBe("");
  });
});

describe("dayLabel", () => {
  // anchored to the module's TODAY = 2026-06-02
  it("labels today + yesterday", () => {
    expect(dayLabel("2026-06-02T08:00:00")).toBe("Today");
    expect(dayLabel("2026-06-01T08:00:00")).toBe("Yesterday");
  });
  it("uses a weekday label for older dates", () => {
    expect(dayLabel("2026-05-28T08:00:00")).toMatch(/May/);
  });
});

describe("daysLabel", () => {
  it("uses day units under a month", () => {
    expect(daysLabel(1)).toBe("1 day in stage");
    expect(daysLabel(14)).toBe("14 days in stage");
  });
  it("switches to month units past 30", () => {
    expect(daysLabel(31)).toBe("1 month in stage");
    expect(daysLabel(90)).toBe("3 months in stage");
  });
});
