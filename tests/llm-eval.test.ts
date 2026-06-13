import { describe, it, expect } from "vitest";
import { checkGrounding, checkMemoGrounding, summarizeGrounding } from "@/lib/llm-eval";
import type { ExtractedSignal } from "@/lib/extract-signal";

const SOURCE =
  "Acme Corp announced it engaged advisers to explore a sale of its coatings unit, " +
  'which generated revenue of $1.2B and EBITDA of $280M last year. "We are running a ' +
  'process," the CFO said. The deal could be valued at $600M.';

function out(over: Partial<ExtractedSignal>): ExtractedSignal {
  return { found: true, ...over } as ExtractedSignal;
}

describe("checkGrounding", () => {
  it("treats a not-found result as trivially grounded", () => {
    const r = checkGrounding({ found: false }, SOURCE);
    expect(r.grounded).toBe(true);
    expect(r.violations).toHaveLength(0);
  });

  it("passes when financials + quote are present in the source", () => {
    const r = checkGrounding(
      out({
        revenue: "$1.2B",
        ebitda: "$280M",
        deal_size: "$600M",
        key_quote: "We are running a process",
      }),
      SOURCE
    );
    expect(r.grounded).toBe(true);
    expect(r.violations).toHaveLength(0);
  });

  it("flags a fabricated revenue figure", () => {
    const r = checkGrounding(out({ revenue: "$9.9B" }), SOURCE);
    expect(r.grounded).toBe(false);
    expect(r.violations[0]!.field).toBe("revenue");
  });

  it("flags a quote that is not a verbatim span", () => {
    const r = checkGrounding(
      out({ key_quote: "The board has unanimously approved an immediate liquidation" }),
      SOURCE
    );
    expect(r.grounded).toBe(false);
    expect(r.violations.some((v) => v.field === "key_quote")).toBe(true);
  });

  it("allows non-numeric financial strings (nothing to fabricate)", () => {
    const r = checkGrounding(out({ margin: "undisclosed" }), SOURCE);
    expect(r.grounded).toBe(true);
  });

  it("collects multiple violations", () => {
    const r = checkGrounding(out({ revenue: "$5B", ebitda: "$77M" }), SOURCE);
    expect(r.violations).toHaveLength(2);
  });
});

describe("summarizeGrounding", () => {
  it("computes a pass rate", () => {
    const s = summarizeGrounding([
      { grounded: true, violations: [] },
      { grounded: false, violations: [{ field: "revenue", value: "$5B", reason: "x" }] },
      { grounded: true, violations: [] },
    ]);
    expect(s.total).toBe(3);
    expect(s.grounded).toBe(2);
    expect(s.violations).toBe(1);
    expect(s.passRate).toBeCloseTo(2 / 3);
  });

  it("treats an empty batch as a full pass", () => {
    expect(summarizeGrounding([]).passRate).toBe(1);
  });
});

describe("checkMemoGrounding", () => {
  const ctx =
    "Company facts: Revenue: $1.2B, EBITDA: $280M, Margin: 23%. Signals: process could " +
    "value the unit at 8.5x EBITDA, around $600M.";

  it("passes when every figure in the memo is in the context", () => {
    const memo =
      "SITUATION — in market. EVIDENCE — revenue $1.2B at 23% margin; talk of 8.5x / $600M.";
    expect(checkMemoGrounding(memo, ctx).grounded).toBe(true);
  });

  it("flags a fabricated dollar figure", () => {
    const r = checkMemoGrounding("Buyers may pay up to $5B for the unit.", ctx);
    expect(r.grounded).toBe(false);
    expect(r.violations[0]!.value).toContain("$5B");
  });

  it("flags a fabricated multiple", () => {
    const r = checkMemoGrounding("Comparable deals cleared at 12x EBITDA.", ctx);
    expect(r.grounded).toBe(false);
  });

  it("ignores prose with no figures", () => {
    expect(checkMemoGrounding("Advisers engaged; process underway.", ctx).grounded).toBe(
      true
    );
  });
});
