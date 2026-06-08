import { describe, it, expect } from "vitest";
import {
  daysSince,
  relativeLabel,
  stageDaysLabel,
  initialsOf,
} from "@/lib/adapters/time";

describe("time helpers", () => {
  it("daysSince counts whole days, never negative", () => {
    expect(daysSince(new Date().toISOString())).toBe(0);
    expect(daysSince(new Date(Date.now() - 3 * 86_400_000).toISOString())).toBe(3);
    expect(daysSince(new Date(Date.now() + 86_400_000).toISOString())).toBe(0);
  });

  it("relativeLabel buckets sensibly", () => {
    expect(relativeLabel(new Date().toISOString())).toBe("today");
    expect(relativeLabel(new Date(Date.now() - 86_400_000).toISOString())).toBe(
      "1 day ago"
    );
    expect(relativeLabel(new Date(Date.now() - 21 * 86_400_000).toISOString())).toBe(
      "3 weeks ago"
    );
  });

  it("stageDaysLabel switches to months past 31 days", () => {
    expect(stageDaysLabel(1)).toBe("1 day in stage");
    expect(stageDaysLabel(10)).toBe("10 days in stage");
    expect(stageDaysLabel(60)).toBe("2 months in stage");
  });

  it("initialsOf takes first two name parts", () => {
    expect(initialsOf("Ashwin Singh")).toBe("AS");
    expect(initialsOf("madonna")).toBe("M");
    expect(initialsOf(null)).toBe("—");
  });
});
