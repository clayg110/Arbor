import { describe, it, expect } from "vitest";
import {
  scoreAlert,
  tierFor,
  rankAndDedupe,
  deliverable,
  type ScoredAlert,
} from "@/lib/alert-priority";
import type { AlertRule, AlertEvent } from "@/lib/alert-rules";

const NOW = Date.parse("2026-06-21T12:00:00Z");

function rule(id: string, userId = "u1"): AlertRule {
  return {
    id,
    userId,
    orgId: null,
    name: `rule ${id}`,
    predicate: {},
    webhook: false,
    emailDelivery: false,
    active: true,
  };
}

function event(over: Partial<AlertEvent> = {}): AlertEvent {
  return {
    companyId: "c1",
    companyName: "Dow Polyurethanes",
    eventType: "moved_in_market",
    stage: "in_market",
    sector: "chemicals",
    dealType: "carveout",
    sponsor: "Dow Inc.",
    confidence: "high",
    convictionScore: 80,
    at: "2026-06-21T10:00:00Z",
    ...over,
  };
}

describe("tierFor", () => {
  it("splits at 40 and 66", () => {
    expect(tierFor(39)).toBe("low");
    expect(tierFor(40)).toBe("normal");
    expect(tierFor(65)).toBe("normal");
    expect(tierFor(66)).toBe("high");
  });
});

describe("scoreAlert", () => {
  it("a fresh, high-conviction live-process alert is high priority", () => {
    const r = scoreAlert(event(), NOW);
    expect(r.tier).toBe("high");
    expect(r.score).toBeGreaterThanOrEqual(66);
  });

  it("a quiet move to on-hold scores below entering the market", () => {
    const live = scoreAlert(event({ eventType: "moved_in_market" }), NOW).score;
    const hold = scoreAlert(event({ eventType: "moved_on_hold" }), NOW).score;
    expect(live).toBeGreaterThan(hold);
  });

  it("recent events outrank stale ones, all else equal", () => {
    const fresh = scoreAlert(event({ at: "2026-06-21T11:00:00Z" }), NOW).score;
    const stale = scoreAlert(event({ at: "2026-06-18T11:00:00Z" }), NOW).score;
    expect(fresh).toBeGreaterThan(stale);
  });

  it("higher conviction and confidence raise the score", () => {
    const strong = scoreAlert(
      event({ convictionScore: 90, confidence: "high" }),
      NOW
    ).score;
    const weak = scoreAlert(
      event({ convictionScore: 10, confidence: "needs_review" }),
      NOW
    ).score;
    expect(strong).toBeGreaterThan(weak);
  });

  it("stays within 0–100", () => {
    const r = scoreAlert(event({ convictionScore: 100, confidence: "high" }), NOW);
    expect(r.score).toBeLessThanOrEqual(100);
    expect(r.score).toBeGreaterThanOrEqual(0);
  });
});

describe("rankAndDedupe", () => {
  it("collapses same-user+company alerts to the highest-priority one", () => {
    const matches = [
      { rule: rule("r1"), event: event({ eventType: "moved_on_hold" }) },
      { rule: rule("r2"), event: event({ eventType: "moved_in_market" }) },
    ];
    const scored = rankAndDedupe(matches, NOW);
    const kept = scored.filter((s) => !s.suppressed);
    expect(kept).toHaveLength(1);
    expect(kept[0]!.event.eventType).toBe("moved_in_market");
    expect(kept[0]!.duplicateCount).toBe(2);
  });

  it("keeps alerts for different companies for the same user", () => {
    const matches = [
      { rule: rule("r1"), event: event({ companyId: "c1" }) },
      { rule: rule("r2"), event: event({ companyId: "c2" }) },
    ];
    expect(deliverable(rankAndDedupe(matches, NOW))).toHaveLength(2);
  });

  it("keeps alerts for different users on the same company", () => {
    const matches = [
      { rule: rule("r1", "u1"), event: event() },
      { rule: rule("r2", "u2"), event: event() },
    ];
    expect(deliverable(rankAndDedupe(matches, NOW))).toHaveLength(2);
  });

  it("returns all alerts (suppressed flagged) sorted by score desc", () => {
    const matches = [
      { rule: rule("r1"), event: event({ companyId: "c1", eventType: "moved_on_hold" }) },
      {
        rule: rule("r2"),
        event: event({ companyId: "c2", eventType: "moved_in_market" }),
      },
    ];
    const scored = rankAndDedupe(matches, NOW);
    expect(scored).toHaveLength(2);
    expect(scored[0]!.score).toBeGreaterThanOrEqual(scored[1]!.score);
  });
});

describe("deliverable", () => {
  it("drops suppressed alerts and sorts by priority", () => {
    const scored: ScoredAlert[] = [
      {
        rule: rule("a"),
        event: event(),
        score: 30,
        tier: "low",
        suppressed: true,
        duplicateCount: 1,
      },
      {
        rule: rule("b"),
        event: event(),
        score: 80,
        tier: "high",
        suppressed: false,
        duplicateCount: 1,
      },
      {
        rule: rule("c"),
        event: event(),
        score: 50,
        tier: "normal",
        suppressed: false,
        duplicateCount: 1,
      },
    ];
    const out = deliverable(scored);
    expect(out.map((s) => s.score)).toEqual([80, 50]);
  });
});
