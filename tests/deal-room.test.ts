import { describe, it, expect } from "vitest";
import {
  buildDealRoom,
  parseKeyDates,
  rankDealRooms,
  ATTENTION_LABEL,
  ATTENTION_COLOR,
  type DealRoomInput,
} from "@/lib/deal-room";

const NOW = new Date("2026-06-20T12:00:00Z");

const base: DealRoomInput = {
  companyId: "1",
  name: "Dow Polyurethanes",
  dealType: "carveout",
  sector: "chemicals",
  ownerName: "Dow Inc.",
  marketStage: "in_market",
  processStage: "first_round_bid",
  keyDates: null,
  lastSignalDaysAgo: 2,
};

describe("parseKeyDates", () => {
  it("sorts ascending, computes day diffs, and skips blanks/invalid", () => {
    const dates = parseKeyDates(
      {
        exclusivity: "2026-06-30",
        first_round_bid: "2026-06-25",
        nda_signed: "",
        cim_received: "not-a-date",
      },
      NOW
    );
    expect(dates.map((d) => d.stage)).toEqual(["first_round_bid", "exclusivity"]);
    expect(dates[0]!.daysUntil).toBe(5);
    expect(dates[1]!.daysUntil).toBe(10);
  });

  it("returns [] for null key dates", () => {
    expect(parseKeyDates(null, NOW)).toEqual([]);
  });
});

describe("buildDealRoom — next action priority", () => {
  it("flags an overdue milestone for the current-or-later stage first", () => {
    const room = buildDealRoom(
      { ...base, keyDates: { first_round_bid: "2026-06-10" } },
      NOW
    );
    expect(room.nextAction?.overdue).toBe(true);
    expect(room.nextAction?.label).toMatch(/overdue/i);
    expect(room.nextAction?.daysUntil).toBe(-10);
  });

  it("otherwise points at the soonest upcoming key date", () => {
    const room = buildDealRoom(
      {
        ...base,
        keyDates: { exclusivity: "2026-06-30", second_round_bid: "2026-06-25" },
      },
      NOW
    );
    expect(room.nextAction?.overdue).toBe(false);
    expect(room.nextAction?.label).toMatch(/due/i);
    expect(room.nextAction?.daysUntil).toBe(5);
  });

  it("falls back to 'advance from <stage>' when there are no dates", () => {
    const room = buildDealRoom({ ...base, keyDates: null }, NOW);
    expect(room.nextAction?.label).toMatch(/advance from/i);
    expect(room.nextAction?.date).toBeNull();
  });

  it("ignores a past milestone for an already-completed earlier stage", () => {
    // We're at first_round_bid; an nda_signed date in the past is behind us, not overdue.
    const room = buildDealRoom({ ...base, keyDates: { nda_signed: "2026-05-01" } }, NOW);
    expect(room.nextAction?.overdue).toBe(false);
    expect(room.nextAction?.label).toMatch(/advance from/i);
  });

  it("has no next action for a terminal (won/passed) process", () => {
    const room = buildDealRoom({ ...base, processStage: "won" }, NOW);
    expect(room.nextAction).toBeNull();
    expect(room.isTerminal).toBe(true);
    expect(room.attentionScore).toBe(0);
  });
});

describe("buildDealRoom — attention", () => {
  it("an overdue deal needs action now", () => {
    const room = buildDealRoom(
      { ...base, keyDates: { first_round_bid: "2026-06-01" } },
      NOW
    );
    expect(room.attention).toBe("now");
  });

  it("a far-off, quiet deal is steady", () => {
    const room = buildDealRoom(
      {
        ...base,
        processStage: "watching",
        keyDates: { teaser_received: "2026-09-01" },
        conviction: { score: 20, band: "cold" },
        lastSignalDaysAgo: 5,
      },
      NOW
    );
    expect(room.attention).toBe("steady");
  });

  it("a stale active deal is flagged and scores higher than a fresh twin", () => {
    const fresh = buildDealRoom({ ...base, lastSignalDaysAgo: 3 }, NOW);
    const stale = buildDealRoom({ ...base, lastSignalDaysAgo: 60 }, NOW);
    expect(stale.stale).toBe(true);
    expect(fresh.stale).toBe(false);
    expect(stale.attentionScore).toBeGreaterThan(fresh.attentionScore);
  });

  it("overdue tasks dominate the attention score", () => {
    const room = buildDealRoom({ ...base, overdueTaskCount: 2 }, NOW);
    expect(room.attentionScore).toBeGreaterThanOrEqual(50);
    expect(room.attention).toBe("now");
  });

  it("a hot, imminent deal outscores a cold one", () => {
    const hot = buildDealRoom(
      {
        ...base,
        conviction: { score: 80, band: "hot" },
        marketTiming: { score: 90, band: "imminent", horizon: "0–6 months", drivers: [] },
      },
      NOW
    );
    const cold = buildDealRoom({ ...base, conviction: { score: 10, band: "cold" } }, NOW);
    expect(hot.attentionScore).toBeGreaterThan(cold.attentionScore);
  });
});

describe("buildDealRoom — process progress", () => {
  it("increases along the pipeline and is full at terminal", () => {
    const early = buildDealRoom({ ...base, processStage: "watching" }, NOW);
    const mid = buildDealRoom({ ...base, processStage: "first_round_bid" }, NOW);
    const late = buildDealRoom({ ...base, processStage: "due_diligence" }, NOW);
    const done = buildDealRoom({ ...base, processStage: "won" }, NOW);
    expect(early.processProgress).toBe(0);
    expect(mid.processProgress).toBeGreaterThan(early.processProgress);
    expect(late.processProgress).toBeGreaterThan(mid.processProgress);
    expect(done.processProgress).toBe(1);
  });

  it("is 0 when no process stage is set", () => {
    expect(buildDealRoom({ ...base, processStage: null }, NOW).processProgress).toBe(0);
  });
});

describe("rankDealRooms", () => {
  it("orders by attention, then soonest next action, then name", () => {
    const urgent = buildDealRoom(
      {
        ...base,
        companyId: "a",
        name: "Alpha",
        keyDates: { first_round_bid: "2026-06-01" },
      },
      NOW
    );
    const soon = buildDealRoom(
      { ...base, companyId: "b", name: "Bravo", keyDates: { exclusivity: "2026-06-26" } },
      NOW
    );
    const quiet = buildDealRoom(
      {
        ...base,
        companyId: "c",
        name: "Charlie",
        processStage: "watching",
        keyDates: null,
        lastSignalDaysAgo: 1,
        conviction: { score: 10, band: "cold" },
      },
      NOW
    );
    const ranked = rankDealRooms([quiet, soon, urgent]);
    expect(ranked.map((r) => r.companyId)).toEqual(["a", "b", "c"]);
  });
});

describe("constants", () => {
  it("expose a label + AA color for every attention level", () => {
    for (const lvl of ["now", "soon", "steady"] as const) {
      expect(ATTENTION_LABEL[lvl]).toBeTruthy();
      expect(ATTENTION_COLOR[lvl]).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
  });
});
