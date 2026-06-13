// Grounding checks for extracted-signal output — the pure core of the LLM eval
// harness. The live harness (scripts/eval/extraction.eval.ts) runs the extractor
// over a golden set, then asserts these invariants; nothing here calls the model,
// so it runs in CI without a key. The same checks can gate runtime extractions if
// we ever want to reject ungrounded output.

import type { ExtractedSignal } from "@/lib/extract-signal";

export interface GroundingViolation {
  field: string;
  value: string;
  reason: string;
}

// Numeric tokens in a value: "$1.2B" → ["1.2"], "23%" → ["23"], "$600M" → ["600"].
function numericTokens(s: string): string[] {
  return s.match(/\d+(?:\.\d+)?/g) ?? [];
}

function norm(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

// Whether the exact number `n` appears in `src` as a standalone figure — not
// embedded in a longer number (so "5" does NOT match inside "8.5" or "1500").
function containsNumber(src: string, n: string): boolean {
  const esc = n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?<![\\d.])${esc}(?![\\d.])`).test(src);
}

// A stated financial is grounded only if every numeric token in it appears in
// the source text — catches fabricated/hallucinated figures.
function valueGrounded(value: string, source: string): boolean {
  const tokens = numericTokens(value);
  if (tokens.length === 0) return true; // no numbers to fabricate
  return tokens.every((n) => containsNumber(source, n));
}

const FINANCIAL_FIELDS = ["revenue", "ebitda", "margin", "deal_size"] as const;
// Min overlap length for treating key_quote as a verbatim span of the source.
const QUOTE_SPAN = 60;

// Assert an extraction is grounded in its source. A not-found result is trivially
// grounded. Returns every violation so the harness can report, not just the first.
export function checkGrounding(
  output: ExtractedSignal,
  sourceText: string
): { grounded: boolean; violations: GroundingViolation[] } {
  const violations: GroundingViolation[] = [];
  if (!output.found) return { grounded: true, violations };

  const src = sourceText ?? "";

  // 1. Financials must not be invented — their figures must be in the source.
  for (const f of FINANCIAL_FIELDS) {
    const v = output[f];
    if (typeof v === "string" && v.trim() && !valueGrounded(v, src)) {
      violations.push({
        field: f,
        value: v,
        reason: "numeric value not found in source text",
      });
    }
  }

  // 2. key_quote should be a (near-)verbatim span of the source, not paraphrase.
  const quote = output.key_quote?.trim();
  if (quote) {
    const probe = norm(quote).slice(0, QUOTE_SPAN);
    if (!norm(src).includes(probe)) {
      violations.push({
        field: "key_quote",
        value: quote,
        reason: "quote is not a verbatim span of the source text",
      });
    }
  }

  return { grounded: violations.length === 0, violations };
}

// Numbers a generated memo must not invent: dollar amounts, multiples (e.g.
// "8.5x"), and percentages. Every such figure in the memo must appear in the
// context it was built from — catches fabricated prices / valuations / multiples,
// the memo prompt's "never invent advisers, prices, or buyers" rule.
const MEMO_FIGURE =
  /\$\s?\d[\d.,]*\s?(?:b|bn|billion|m|mm|million|k|thousand)?|\d+(?:\.\d+)?\s?x|\d+(?:\.\d+)?\s?%/gi;

// Grounding check for a generated memo / brief against its source context.
export function checkMemoGrounding(
  memo: string,
  context: string
): { grounded: boolean; violations: GroundingViolation[] } {
  const violations: GroundingViolation[] = [];
  const src = context ?? "";
  const figures = memo.match(MEMO_FIGURE) ?? [];
  for (const fig of figures) {
    // A figure is grounded if every numeric token in it appears in the context.
    const grounded = numericTokens(fig).every((n) => containsNumber(src, n));
    if (!grounded) {
      violations.push({
        field: "memo",
        value: fig.trim(),
        reason: "figure not found in context",
      });
    }
  }
  return { grounded: violations.length === 0, violations };
}

// Aggregate a batch of grounding results into a pass-rate summary for the harness.
export function summarizeGrounding(
  results: { grounded: boolean; violations: GroundingViolation[] }[]
): { total: number; grounded: number; passRate: number; violations: number } {
  const total = results.length;
  const grounded = results.filter((r) => r.grounded).length;
  const violations = results.reduce((n, r) => n + r.violations.length, 0);
  return {
    total,
    grounded,
    passRate: total === 0 ? 1 : grounded / total,
    violations,
  };
}
