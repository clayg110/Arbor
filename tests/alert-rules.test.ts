import { describe, it, expect } from "vitest";
import {
  matchRule,
  rulesForEvent,
  describeRule,
  describeEvent,
  alertNotificationRows,
  toAlertRule,
  type AlertRule,
  type AlertEvent,
} from "@/lib/alert-rules";
import type { DbAlertRule } from "@/types/db";

const event: AlertEvent = {
  companyId: "c1",
  companyName: "Dow Polyurethanes",
  eventType: "moved_in_market",
  stage: "in_market",
  sector: "chemicals",
  dealType: "carveout",
  sponsor: "Carlyle Group",
  confidence: "high",
  convictionScore: 80,
  at: "2026-06-01T00:00:00Z",
};

function rule(
  predicate: AlertRule["predicate"],
  over: Partial<AlertRule> = {}
): AlertRule {
  return {
    id: "r1",
    userId: "u1",
    orgId: null,
    name: "Test rule",
    predicate,
    webhook: false,
    emailDelivery: false,
    active: true,
    ...over,
  };
}

describe("matchRule", () => {
  it("empty predicate is a catch-all", () => {
    expect(matchRule(rule({}), event)).toBe(true);
  });

  it("inactive rules never match", () => {
    expect(matchRule(rule({}, { active: false }), event)).toBe(false);
  });

  it("matches each dimension and ANDs them", () => {
    expect(matchRule(rule({ sector: "chemicals" }), event)).toBe(true);
    expect(matchRule(rule({ sector: "industrials" }), event)).toBe(false);
    expect(matchRule(rule({ dealType: "carveout" }), event)).toBe(true);
    expect(matchRule(rule({ dealType: "private_asset" }), event)).toBe(false);
    expect(matchRule(rule({ stageEnters: "in_market" }), event)).toBe(true);
    expect(matchRule(rule({ stageEnters: "on_hold" }), event)).toBe(false);
    // all must hold
    expect(
      matchRule(rule({ sector: "chemicals", dealType: "private_asset" }), event)
    ).toBe(false);
  });

  it("nameContains is case-insensitive substring on companyName", () => {
    expect(matchRule(rule({ nameContains: "Dow" }), event)).toBe(true);
    expect(matchRule(rule({ nameContains: "dow" }), event)).toBe(true);
    expect(matchRule(rule({ nameContains: "EXXON" }), event)).toBe(false);
  });

  it("sponsorContains is case-insensitive substring", () => {
    expect(matchRule(rule({ sponsorContains: "carlyle" }), event)).toBe(true);
    expect(matchRule(rule({ sponsorContains: "Apollo" }), event)).toBe(false);
    const noSponsor = { ...event, sponsor: null };
    expect(matchRule(rule({ sponsorContains: "x" }), noSponsor)).toBe(false);
  });

  it("minConfidence uses rank ordering", () => {
    expect(matchRule(rule({ minConfidence: "medium" }), event)).toBe(true); // high >= medium
    expect(
      matchRule(rule({ minConfidence: "high" }), { ...event, confidence: "low" })
    ).toBe(false);
  });

  it("minConviction gates on score (default 0 when absent)", () => {
    expect(matchRule(rule({ minConviction: 70 }), event)).toBe(true);
    expect(matchRule(rule({ minConviction: 90 }), event)).toBe(false);
    expect(
      matchRule(rule({ minConviction: 10 }), { ...event, convictionScore: undefined })
    ).toBe(false);
  });
});

describe("rulesForEvent", () => {
  it("returns only the matching rules", () => {
    const rules = [
      rule({ sector: "chemicals" }, { id: "a" }),
      rule({ sector: "industrials" }, { id: "b" }),
      rule({ minConviction: 50 }, { id: "c" }),
    ];
    expect(rulesForEvent(rules, event).map((r) => r.id)).toEqual(["a", "c"]);
  });
});

describe("alertNotificationRows", () => {
  it("builds idempotent rows keyed by rule+company+time", () => {
    const rows = alertNotificationRows([{ rule: rule({}), event }]);
    expect(rows[0]).toMatchObject({
      user_id: "u1",
      type: "alert",
      title: "Dow Polyurethanes",
      entity_id: "c1",
      dedupe_key: "alert:r1:c1:moved_in_market:2026-06-01T00:00:00Z",
    });
    expect(rows[0].body).toContain("entered In market");
  });
});

describe("describeRule / describeEvent", () => {
  it("summarizes a predicate", () => {
    expect(describeRule({})).toBe("Any deal activity");
    const s = describeRule({
      sector: "chemicals",
      stageEnters: "in_market",
      minConviction: 70,
      nameContains: "Dow",
    });
    expect(s).toContain("chemicals");
    expect(s).toContain("enters In market");
    expect(s).toContain("conviction ≥ 70");
    expect(s).toContain('name ~ "Dow"');
  });

  it("labels known event types", () => {
    expect(describeEvent("new_entry")).toBe("added to the tracker");
    expect(describeEvent("whatever")).toBe("updated");
  });
});

describe("toAlertRule", () => {
  it("maps a DB row, defaulting a null predicate to {}", () => {
    const db = {
      id: "r9",
      user_id: "u9",
      org_id: "org1",
      name: "n",
      predicate: { sector: "chemicals" },
      webhook: true,
      active: true,
      created_at: "x",
    } as unknown as DbAlertRule;
    const r = toAlertRule(db);
    expect(r).toMatchObject({ id: "r9", userId: "u9", orgId: "org1", webhook: true });
    expect(r.predicate.sector).toBe("chemicals");
  });
});
