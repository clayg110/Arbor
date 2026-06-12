import { describe, it, expect } from "vitest";
import {
  IC_SECTIONS,
  buildIcContext,
  icMemoHash,
  parseIcMemo,
  formatIcMemoMarkdown,
} from "@/lib/ic-memo";
import type { Company, Signal } from "@/lib/types";
import type { CompResult } from "@/lib/comps";

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
    excerpt: "Advisers engaged to explore strategic alternatives.",
    ingestedAt: "2026-05-30",
  } as unknown as Signal,
];

const comps: CompResult[] = [
  {
    id: "x1",
    name: "GEON",
    sector: "chemicals",
    dealType: "private_asset",
    stage: "in_market",
    revenue: "$900M",
    ebitda: "$150M",
    outcome: "closed",
    score: 80,
    matchReasons: ["same sector"],
  } as unknown as CompResult,
];

describe("IC_SECTIONS", () => {
  it("has the eight canonical sections in order", () => {
    expect(IC_SECTIONS.map((s) => s.title)).toEqual([
      "Executive Summary",
      "Business Description",
      "Investment Thesis",
      "Key Risks",
      "Comparable Transactions",
      "Process Status",
      "Conviction & Signals",
      "Recommendation",
    ]);
  });
});

describe("buildIcContext", () => {
  it("includes process stage label when set", () => {
    const ctx = buildIcContext(company, signals, "nda_signed", comps);
    expect(ctx).toContain("Our internal process stage: NDA signed");
  });

  it("notes when process stage is unset", () => {
    const ctx = buildIcContext(company, signals, null, comps);
    expect(ctx).toContain("not set");
  });

  it("lists comparable transactions", () => {
    const ctx = buildIcContext(company, signals, null, comps);
    expect(ctx).toContain("Comparable transactions");
    expect(ctx).toContain("GEON");
  });

  it("states none when no comps", () => {
    const ctx = buildIcContext(company, signals, null, []);
    expect(ctx).toContain("none on file");
  });

  it("carries base company facts through", () => {
    const ctx = buildIcContext(company, signals, null, comps);
    expect(ctx).toContain("Dow Polyurethanes");
  });
});

describe("icMemoHash", () => {
  it("is stable for identical inputs", () => {
    expect(icMemoHash(signals, "nda_signed", comps)).toBe(
      icMemoHash(signals, "nda_signed", comps)
    );
  });

  it("changes when the process stage changes", () => {
    expect(icMemoHash(signals, "nda_signed", comps)).not.toBe(
      icMemoHash(signals, "cim_received", comps)
    );
  });

  it("changes when the comp set changes", () => {
    expect(icMemoHash(signals, "nda_signed", comps)).not.toBe(
      icMemoHash(signals, "nda_signed", [])
    );
  });

  it("changes when signals change", () => {
    const more = [...signals, { ...signals[0]!, id: "s2" }];
    expect(icMemoHash(signals, null, comps)).not.toBe(icMemoHash(more, null, comps));
  });
});

describe("parseIcMemo", () => {
  const raw = `EXECUTIVE SUMMARY — Dow is carving out its polyurethanes unit.
Advisers are engaged.

BUSINESS DESCRIPTION
A polyurethanes and PO/PG producer.

INVESTMENT THESIS — Cost-out and margin recovery.

KEY RISKS — Single-source signal; cyclical end markets.

COMPARABLE TRANSACTIONS — Limited; GEON closed recently.

PROCESS STATUS — We are at NDA signed.

CONVICTION & SIGNALS — One SEC filing; medium corroboration.

RECOMMENDATION — Progress to management presentation.`;

  it("returns all eight sections", () => {
    const parsed = parseIcMemo(raw);
    expect(parsed).toHaveLength(8);
  });

  it("captures body text per section", () => {
    const parsed = parseIcMemo(raw);
    const byTitle = Object.fromEntries(parsed.map((s) => [s.title, s.body]));
    expect(byTitle["Executive Summary"]).toContain("carving out");
    expect(byTitle["Business Description"]).toContain("PO/PG");
    expect(byTitle["Recommendation"]).toContain("management presentation");
  });

  it("handles the '&' in CONVICTION & SIGNALS", () => {
    const parsed = parseIcMemo(raw);
    const cs = parsed.find((s) => s.title === "Conviction & Signals");
    expect(cs?.body).toContain("corroboration");
  });

  it("leaves missing sections empty", () => {
    const parsed = parseIcMemo("EXECUTIVE SUMMARY — Just this.");
    const empty = parsed.filter((s) => s.body === "");
    expect(empty.length).toBe(7);
    expect(parsed[0]!.body).toBe("Just this.");
  });

  it("ignores preamble before the first header", () => {
    const parsed = parseIcMemo("Here is your memo:\nEXECUTIVE SUMMARY — Body.");
    expect(parsed[0]!.body).toBe("Body.");
  });
});

describe("formatIcMemoMarkdown", () => {
  it("renders a titled markdown doc with only populated sections", () => {
    const sections = [
      { title: "Executive Summary", body: "The opportunity." },
      { title: "Key Risks", body: "" },
      { title: "Recommendation", body: "Progress." },
    ];
    const md = formatIcMemoMarkdown(company, sections, "2026-06-11T00:00:00Z");
    expect(md).toContain("# IC Memo — Dow Polyurethanes");
    expect(md).toContain("## Executive Summary");
    expect(md).toContain("## Recommendation");
    expect(md).not.toContain("## Key Risks");
    expect(md).toContain("2026-06-11");
  });
});
