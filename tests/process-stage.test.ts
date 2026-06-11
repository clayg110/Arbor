import { describe, it, expect } from "vitest";
import {
  PROCESS_STAGES,
  PROCESS_STAGE_LABELS,
  PROCESS_STAGE_SHORT,
  PROCESS_STAGE_COLORS,
  processStageIndex,
  isTerminalStage,
  isActiveStage,
  processStripSummary,
  type OurProcessStage,
} from "@/lib/process-stage";

describe("PROCESS_STAGES", () => {
  it("contains 12 stages", () => {
    expect(PROCESS_STAGES).toHaveLength(12);
  });

  it("starts with watching and ends with passed", () => {
    expect(PROCESS_STAGES[0]).toBe("watching");
    expect(PROCESS_STAGES[PROCESS_STAGES.length - 1]).toBe("passed");
  });

  it("has won and passed as last two", () => {
    expect(PROCESS_STAGES.at(-2)).toBe("won");
    expect(PROCESS_STAGES.at(-1)).toBe("passed");
  });
});

describe("PROCESS_STAGE_LABELS", () => {
  it("has a label for every stage", () => {
    for (const s of PROCESS_STAGES) {
      expect(PROCESS_STAGE_LABELS[s]).toBeTruthy();
    }
  });

  it("returns correct labels", () => {
    expect(PROCESS_STAGE_LABELS.nda_signed).toBe("NDA signed");
    expect(PROCESS_STAGE_LABELS.first_round_bid).toBe("First round bid");
    expect(PROCESS_STAGE_LABELS.won).toBe("Won");
  });
});

describe("PROCESS_STAGE_SHORT", () => {
  it("has a short label for every stage", () => {
    for (const s of PROCESS_STAGES) {
      expect(PROCESS_STAGE_SHORT[s]).toBeTruthy();
    }
  });
});

describe("PROCESS_STAGE_COLORS", () => {
  it("has bg, text, and border for every stage", () => {
    for (const s of PROCESS_STAGES) {
      const c = PROCESS_STAGE_COLORS[s];
      expect(c.bg).toMatch(/^#/);
      expect(c.text).toMatch(/^#/);
      expect(c.border).toMatch(/^#/);
    }
  });
});

describe("processStageIndex", () => {
  it("returns correct index", () => {
    expect(processStageIndex("watching")).toBe(0);
    expect(processStageIndex("nda_signed")).toBe(2);
    expect(processStageIndex("won")).toBe(10);
    expect(processStageIndex("passed")).toBe(11);
  });
});

describe("isTerminalStage", () => {
  it("marks won and passed as terminal", () => {
    expect(isTerminalStage("won")).toBe(true);
    expect(isTerminalStage("passed")).toBe(true);
  });

  it("marks all other stages as non-terminal", () => {
    const active: OurProcessStage[] = PROCESS_STAGES.filter(
      (s) => s !== "won" && s !== "passed"
    );
    for (const s of active) {
      expect(isTerminalStage(s)).toBe(false);
    }
  });
});

describe("isActiveStage", () => {
  it("is inverse of isTerminalStage", () => {
    for (const s of PROCESS_STAGES) {
      expect(isActiveStage(s)).toBe(!isTerminalStage(s));
    }
  });
});

describe("processStripSummary", () => {
  it("returns no-processes message when empty", () => {
    expect(processStripSummary({})).toBe("No active processes");
  });

  it("formats single stage correctly", () => {
    const result = processStripSummary({ nda_signed: 3 });
    expect(result).toBe("3 NDA signed");
  });

  it("joins multiple stages with ·", () => {
    const result = processStripSummary({
      nda_signed: 2,
      first_round_bid: 1,
    });
    expect(result).toBe("2 NDA signed · 1 First round bid");
  });

  it("includes won and passed at end", () => {
    const result = processStripSummary({ watching: 1, won: 2, passed: 1 });
    expect(result).toBe("1 Watching · 2 Won · 1 Passed");
  });

  it("omits stages with zero count", () => {
    const result = processStripSummary({ watching: 0, nda_signed: 2 });
    expect(result).toBe("2 NDA signed");
  });
});
