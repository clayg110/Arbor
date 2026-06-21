import { describe, it, expect } from "vitest";
import {
  sourceCredibility,
  sourceStrength,
  isCredibilityCorroborated,
  tierFor,
  CREDIBILITY_TIER_LABEL,
  CREDIBILITY_TIER_COLOR,
} from "@/lib/source-credibility";

describe("sourceCredibility", () => {
  it("ranks primary filings above news", () => {
    expect(sourceCredibility("sec_filing")).toBeGreaterThan(
      sourceCredibility("google_news")
    );
    expect(sourceCredibility("earnings_transcript")).toBeGreaterThan(
      sourceCredibility("rss_feed")
    );
  });
});

describe("tierFor", () => {
  it("splits at 55 and 85", () => {
    expect(tierFor(54)).toBe("thin");
    expect(tierFor(55)).toBe("corroborated");
    expect(tierFor(84)).toBe("corroborated");
    expect(tierFor(85)).toBe("primary");
  });
});

describe("sourceStrength", () => {
  it("a single SEC filing is a primary source", () => {
    const s = sourceStrength(["sec_filing"]);
    expect(s.tier).toBe("primary");
    expect(s.score).toBe(100);
    expect(s.topSource).toBe("sec_filing");
    expect(s.distinctSources).toBe(1);
  });

  it("a single news item is thin", () => {
    expect(sourceStrength(["google_news"]).tier).toBe("thin");
  });

  it("one primary filing outranks three news reposts", () => {
    const filing = sourceStrength(["sec_filing"]).score;
    const news = sourceStrength(["google_news", "rss_feed", "google_news"]).score;
    expect(filing).toBeGreaterThan(news);
  });

  it("rewards diversity: adding distinct sources raises the score", () => {
    const one = sourceStrength(["google_news"]).score;
    const more = sourceStrength(["google_news", "rss_feed", "manual"]).score;
    expect(more).toBeGreaterThan(one);
  });

  it("de-duplicates repeated source types", () => {
    expect(sourceStrength(["google_news", "google_news"]).distinctSources).toBe(1);
  });

  it("surfaces the highest-credibility source as topSource", () => {
    expect(sourceStrength(["google_news", "sec_filing", "rss_feed"]).topSource).toBe(
      "sec_filing"
    );
  });

  it("is empty-safe", () => {
    expect(sourceStrength([])).toEqual({
      score: 0,
      tier: "thin",
      distinctSources: 0,
      topSource: null,
    });
  });

  it("caps the score at 100", () => {
    const s = sourceStrength([
      "sec_filing",
      "hsr_filing",
      "earnings_transcript",
      "manual",
    ]);
    expect(s.score).toBeLessThanOrEqual(100);
  });
});

describe("isCredibilityCorroborated", () => {
  it("is true for a primary source, false for a lone news blurb", () => {
    expect(isCredibilityCorroborated(["sec_filing"])).toBe(true);
    expect(isCredibilityCorroborated(["google_news"])).toBe(false);
  });
});

describe("tier constants", () => {
  it("expose a label + AA color for every tier", () => {
    for (const t of ["primary", "corroborated", "thin"] as const) {
      expect(CREDIBILITY_TIER_LABEL[t]).toBeTruthy();
      expect(CREDIBILITY_TIER_COLOR[t]).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
  });
});
