import { describe, it, expect } from "vitest";
import { buildSignalTimeline } from "@/lib/signal-timeline";
import type { Signal } from "@/lib/types";

function sig(
  id: string,
  date: string,
  sourceType: Signal["sourceType"] = "sec_filing"
): Signal {
  return {
    id,
    companyId: "c1",
    sourceType,
    sourceUrl: "https://example.com",
    title: `Signal ${id}`,
    excerpt: `Excerpt ${id}`,
    ingestedAt: date,
  };
}

const TODAY = "2026-06-01";

describe("buildSignalTimeline", () => {
  it("returns empty dots and ticks for empty signals", () => {
    const { dots, ticks } = buildSignalTimeline([], TODAY);
    expect(dots).toHaveLength(0);
    expect(ticks.length).toBeGreaterThan(0); // always has ticks
  });

  it("generates ~12 month ticks for 12-month window (12 or 13 depending on boundary)", () => {
    const { ticks } = buildSignalTimeline([], TODAY, 12);
    expect(ticks.length).toBeGreaterThanOrEqual(12);
    expect(ticks.length).toBeLessThanOrEqual(13);
  });

  it("generates fewer ticks for shorter windows", () => {
    const { ticks12 } = { ticks12: buildSignalTimeline([], TODAY, 12).ticks };
    const { ticks } = buildSignalTimeline([], TODAY, 3);
    expect(ticks.length).toBeLessThan(ticks12.length);
  });

  it("places signal at correct x within range", () => {
    const s = sig("s1", TODAY);
    const { dots } = buildSignalTimeline([s], TODAY);
    expect(dots).toHaveLength(1);
    // Signal on endDate should be at 100%
    expect(dots[0].x).toBeCloseTo(100, 0);
  });

  it("excludes signals before the window", () => {
    const old = sig("old", "2020-01-01");
    const { dots } = buildSignalTimeline([old], TODAY);
    expect(dots).toHaveLength(0);
  });

  it("excludes signals after the window", () => {
    const future = sig("fut", "2030-01-01");
    const { dots } = buildSignalTimeline([future], TODAY);
    expect(dots).toHaveLength(0);
  });

  it("groups multiple signals on same date into one dot", () => {
    const s1 = sig("s1", "2026-05-15");
    const s2 = sig("s2", "2026-05-15", "google_news");
    const { dots } = buildSignalTimeline([s1, s2], TODAY);
    expect(dots).toHaveLength(1);
    expect(dots[0].signals).toHaveLength(2);
  });

  it("keeps signals on different dates as separate dots", () => {
    const s1 = sig("s1", "2026-04-01");
    const s2 = sig("s2", "2026-05-01");
    const { dots } = buildSignalTimeline([s1, s2], TODAY);
    expect(dots).toHaveLength(2);
  });

  it("dots are sorted ascending by x", () => {
    const early = sig("e", "2025-12-01");
    const late = sig("l", "2026-05-01");
    const { dots } = buildSignalTimeline([late, early], TODAY);
    expect(dots[0].date).toBe("2025-12-01");
    expect(dots[1].date).toBe("2026-05-01");
  });

  it("primarySource picks hsr_filing over sec_filing", () => {
    const s1 = sig("s1", "2026-05-15", "sec_filing");
    const s2 = sig("s2", "2026-05-15", "hsr_filing");
    const { dots } = buildSignalTimeline([s1, s2], TODAY);
    expect(dots[0].primarySource).toBe("sec_filing");
  });

  it("x is clamped to 0–100", () => {
    const borderline = sig("b", TODAY);
    const { dots } = buildSignalTimeline([borderline], TODAY);
    expect(dots[0].x).toBeGreaterThanOrEqual(0);
    expect(dots[0].x).toBeLessThanOrEqual(100);
  });

  it("tick labels are month abbreviations", () => {
    const { ticks } = buildSignalTimeline([], TODAY, 3);
    const validAbbr = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];
    for (const t of ticks) {
      expect(validAbbr).toContain(t.label);
    }
  });

  it("tick x positions are between 0 and 100", () => {
    const { ticks } = buildSignalTimeline([], TODAY);
    for (const t of ticks) {
      expect(t.x).toBeGreaterThanOrEqual(0);
      expect(t.x).toBeLessThanOrEqual(100);
    }
  });

  it("startDate and endDate are returned correctly", () => {
    const { startDate, endDate } = buildSignalTimeline([], TODAY);
    expect(endDate).toBe(TODAY);
    expect(new Date(startDate).getTime()).toBeLessThan(new Date(endDate).getTime());
  });
});
