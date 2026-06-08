import { describe, it, expect } from "vitest";
import { toReviewRow } from "@/lib/adapters";
import type { DbCompany, DbSignal } from "@/types/db";

const company: DbCompany = {
  id: "uuid-1",
  name: "Dow Polyurethanes",
  sector: "chemicals",
  subsector: null,
  deal_type: "carveout",
  sponsor_firm: null,
  parent_company: "Dow Inc.",
  description: "A unit being divested.",
  confidence: "needs_review",
  current_stage: "in_market",
  current_stage_since: new Date(Date.now() - 5 * 86_400_000).toISOString(),
  logo_url: null,
  revenue: null,
  ebitda: null,
  margin: null,
  revenue_source_url: null,
  ebitda_source_url: null,
  created_at: new Date(Date.now() - 20 * 86_400_000).toISOString(),
  updated_at: new Date().toISOString(),
};

function sig(llm_output: unknown, raw_text = ""): DbSignal {
  return { id: "s", company_id: "uuid-1", llm_output, raw_text } as unknown as DbSignal;
}

describe("toReviewRow", () => {
  it("surfaces a conflict when a signal carries one", () => {
    const signals = [
      sig({
        conflict: {
          signalA: { source: "EDGAR", text: "in market" },
          signalB: { source: "News", text: "deal pulled" },
        },
      }),
    ];
    const r = toReviewRow(company, signals);
    expect(r.reason).toBe("Conflicting signals");
    expect(r.conflictSummary).toContain("EDGAR");
    expect(r.conflictSummary).toContain("News");
    expect(r.company.id).toBe("uuid-1");
  });

  it("uses the latest reasoning when present and no conflict", () => {
    const r = toReviewRow(company, [sig({ reasoning: "thin corroboration" })]);
    expect(r.reason).toBe("Low-confidence entry");
    expect(r.conflictSummary).toBe("thin corroboration");
  });

  it("falls back to raw text, then the default summary", () => {
    expect(toReviewRow(company, [sig(null, "raw snippet")]).conflictSummary).toBe(
      "raw snippet"
    );
    expect(toReviewRow(company, []).conflictSummary).toMatch(/Awaiting/);
  });
});
