import { describe, it, expect, afterEach, vi } from "vitest";
import {
  truncate,
  memoSignalsHash,
  buildContext,
  generateMemo,
  answerQuestion,
} from "@/lib/memo";
import type { Company, Signal } from "@/lib/types";

afterEach(() => vi.unstubAllEnvs());

const company = {
  id: "c1",
  name: "Dow Polyurethanes",
  sector: "chemicals",
  subsector: "Polyurethanes",
  dealType: "carveout",
  sponsorFirm: null,
  parentCompany: "Dow Inc.",
  description: "",
  confidence: "high",
  currentStage: "in_market",
  daysInStage: 47,
  firstTracked: "2026-03-15",
  lastUpdated: "2026-06-01",
  revenue: "$1.2B",
  ebitda: "$280M",
  margin: "23%",
} as unknown as Company;

const signals: Signal[] = [
  {
    id: "s1",
    companyId: "c1",
    sourceType: "sec_filing",
    sourceUrl: "https://sec.gov/x",
    sourceName: "SEC 8-K",
    title: "SEC 8-K",
    excerpt: "Advisers engaged to explore strategic alternatives for the segment.",
    ingestedAt: "2026-05-30T00:00:00Z",
  },
  {
    id: "s2",
    companyId: "c1",
    sourceType: "google_news",
    sourceUrl: "https://news/x",
    title: "Bloomberg",
    excerpt: "Process could value the unit at more than $2B.",
    ingestedAt: "2026-05-28T00:00:00Z",
  },
];

describe("truncate", () => {
  it("leaves short strings; ellipsizes long ones", () => {
    expect(truncate("hello", 10)).toBe("hello");
    expect(truncate("hello world", 6)).toBe("hello…");
    expect(truncate("  spaced  ", 20)).toBe("spaced");
  });
});

describe("memoSignalsHash", () => {
  it("is stable + order-independent over the same signal set", () => {
    const h1 = memoSignalsHash(signals);
    const h2 = memoSignalsHash([signals[1], signals[0]]);
    expect(h1).toBe(h2);
    expect(h1).toMatch(/^[0-9a-f]{64}$/);
  });

  it("changes when a signal is added", () => {
    const more = [
      ...signals,
      { ...signals[0], id: "s3", ingestedAt: "2026-06-02T00:00:00Z" },
    ];
    expect(memoSignalsHash(more)).not.toBe(memoSignalsHash(signals));
  });
});

describe("buildContext", () => {
  it("includes company facts (parent for a carveout) + financials", () => {
    const ctx = buildContext(company, signals);
    expect(ctx).toContain("Company: Dow Polyurethanes");
    expect(ctx).toContain("Parent: Dow Inc.");
    expect(ctx).toContain("in_market (47 days in stage)");
    expect(ctx).toContain("Revenue: $1.2B");
  });

  it("numbers each signal with its source type + date", () => {
    const ctx = buildContext(company, signals);
    expect(ctx).toContain("1. [sec_filing · SEC 8-K]");
    expect(ctx).toContain("(2026-05-30)");
  });

  it("handles a company with no signals", () => {
    expect(buildContext(company, [])).toContain("No signals recorded yet.");
  });
});

describe("dormant (no ANTHROPIC_API_KEY)", () => {
  it("generateMemo + answerQuestion resolve to null without calling out", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    expect(await generateMemo(company, signals)).toBeNull();
    expect(await answerQuestion(company, signals, "Who is advising?")).toBeNull();
  });
});
