import { describe, it, expect } from "vitest";
import { needsStepUp } from "@/lib/mfa";

describe("needsStepUp", () => {
  it("requires step-up when nextLevel is aal2 from aal1", () => {
    expect(needsStepUp({ currentLevel: "aal1", nextLevel: "aal2" })).toBe(true);
  });
  it("no step-up when already aal2 or no factor", () => {
    expect(needsStepUp({ currentLevel: "aal2", nextLevel: "aal2" })).toBe(false);
    expect(needsStepUp({ currentLevel: "aal1", nextLevel: "aal1" })).toBe(false);
    expect(needsStepUp(null)).toBe(false);
  });
});
