import { describe, it, expect } from "vitest";
import {
  aggregateFeedback,
  adjustedConfidence,
  wasAdjusted,
  netLabel,
  type FeedbackVote,
} from "@/lib/signal-feedback";

describe("aggregateFeedback", () => {
  it("counts ups, downs, net and total", () => {
    const votes: FeedbackVote[] = ["up", "up", "down", "up"];
    expect(aggregateFeedback(votes)).toEqual({ up: 3, down: 1, net: 2, total: 4 });
  });

  it("is empty-safe", () => {
    expect(aggregateFeedback([])).toEqual({ up: 0, down: 0, net: 0, total: 0 });
  });
});

describe("adjustedConfidence", () => {
  const agg = (up: number, down: number) =>
    aggregateFeedback([
      ...Array<FeedbackVote>(up).fill("up"),
      ...Array<FeedbackVote>(down).fill("down"),
    ]);

  it("promotes one step on strong net agreement", () => {
    expect(adjustedConfidence("medium", agg(3, 0))).toBe("high");
    expect(adjustedConfidence("low", agg(2, 0))).toBe("medium");
  });

  it("demotes one step on strong net disagreement", () => {
    expect(adjustedConfidence("high", agg(0, 3))).toBe("medium");
    expect(adjustedConfidence("low", agg(0, 2))).toBe("needs_review");
  });

  it("does not move on weak or balanced feedback", () => {
    expect(adjustedConfidence("medium", agg(1, 0))).toBe("medium");
    expect(adjustedConfidence("medium", agg(3, 3))).toBe("medium");
  });

  it("never moves more than one step or past the ends", () => {
    expect(adjustedConfidence("high", agg(10, 0))).toBe("high"); // already top
    expect(adjustedConfidence("needs_review", agg(0, 10))).toBe("needs_review"); // already bottom
    expect(adjustedConfidence("needs_review", agg(10, 0))).toBe("low"); // only one step up
  });

  it("wasAdjusted reflects whether the nudge changed anything", () => {
    expect(wasAdjusted("medium", agg(3, 0))).toBe(true);
    expect(wasAdjusted("medium", agg(1, 0))).toBe(false);
  });
});

describe("netLabel", () => {
  it("formats signed net with an empty string for no votes", () => {
    expect(netLabel(aggregateFeedback([]))).toBe("");
    expect(netLabel(aggregateFeedback(["up", "up"]))).toBe("+2");
    expect(netLabel(aggregateFeedback(["down"]))).toBe("−1");
    expect(netLabel(aggregateFeedback(["up", "down"]))).toBe("0");
  });
});
