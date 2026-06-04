import { describe, it, expect } from "vitest";
import {
  toRadarCompany,
  toCompanyProfile,
  toSummaryStrip,
  toRangeStats,
  toNotes,
} from "@/lib/adapters";
import type { DbCompany, SummaryCountsRow, EventCountsRow, DbNote } from "@/types/db";

const company: DbCompany = {
  id: "uuid-1",
  name: "Dow Polyurethanes",
  sector: "chemicals",
  subsector: null,
  deal_type: "carveout",
  sponsor_firm: null,
  parent_company: "Dow Inc.",
  description: "A unit being divested.",
  confidence: "high",
  current_stage: "in_market",
  current_stage_since: new Date(Date.now() - 10 * 86_400_000).toISOString(),
  logo_url: null,
  revenue: null,
  ebitda: null,
  margin: null,
  revenue_source_url: null,
  ebitda_source_url: null,
  created_at: new Date(Date.now() - 40 * 86_400_000).toISOString(),
  updated_at: new Date().toISOString(),
};

describe("toRadarCompany", () => {
  it("maps snake_case → camelCase and picks the carveout owner", () => {
    const r = toRadarCompany(company, null, true);
    expect(r.id).toBe("uuid-1");
    expect(r.dealType).toBe("carveout");
    expect(r.ownerName).toBe("Dow Inc.");
    expect(r.watchlisted).toBe(true);
    expect(r.days).toBeGreaterThanOrEqual(9);
  });

  it("falls back to sponsor, then Undisclosed", () => {
    const priv = { ...company, deal_type: "private_asset" as const, parent_company: null, sponsor_firm: "KKR" };
    expect(toRadarCompany(priv).ownerName).toBe("KKR");
    const none = { ...company, parent_company: null, sponsor_firm: null };
    expect(toRadarCompany(none).ownerName).toBe("Undisclosed");
  });

  it("flags pulled companies", () => {
    const pulled = { ...company, current_stage: "pulled" as const };
    expect(toRadarCompany(pulled).pulled).toBe(true);
  });
});

describe("toCompanyProfile", () => {
  it("maps profile fields", () => {
    const p = toCompanyProfile(company);
    expect(p.dealType).toBe("carveout");
    expect(p.parentCompany).toBe("Dow Inc.");
    expect(p.currentStage).toBe("in_market");
    expect(p.daysInStage).toBeGreaterThanOrEqual(9);
  });
});

describe("toSummaryStrip", () => {
  it("renames count columns", () => {
    const row: SummaryCountsRow = {
      total: 1054, in_market: 178, monitor: 354, on_hold: 522,
      needs_review: 175, new_this_week: 4, new_carveout: 2, new_private: 2,
    };
    const s = toSummaryStrip(row);
    expect(s.total).toBe(1054);
    expect(s.inMarket).toBe(178);
    expect(s.onHold).toBe(522);
    expect(s.newCarveout).toBe(2);
  });
});

describe("toRangeStats", () => {
  it("maps event counts (confidence_updates → confidence)", () => {
    const row: EventCountsRow = {
      stage_changes: 12, new_entries: 5, pulled: 1, flagged: 3, confidence_updates: 7,
    };
    const s = toRangeStats(row);
    expect(s.stageChanges).toBe(12);
    expect(s.confidence).toBe(7);
  });
});

describe("toNotes", () => {
  it("derives initials and carries userId for ownership checks", () => {
    const row: DbNote = {
      id: "n1", company_id: "uuid-1", user_id: "user-9",
      author: "Ashwin Singh", content: "Looks active.",
      created_at: new Date().toISOString(),
    };
    const [n] = toNotes([row]);
    expect(n.initials).toBe("AS");
    expect(n.userId).toBe("user-9");
  });
});
