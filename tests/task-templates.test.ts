import { describe, it, expect } from "vitest";
import {
  checklistForStage,
  hasChecklist,
  stagesWithChecklist,
  suggestedTasks,
} from "@/lib/task-templates";

describe("checklistForStage / hasChecklist", () => {
  it("returns the playbook for an active stage", () => {
    const items = checklistForStage("nda_signed");
    expect(items.length).toBeGreaterThan(0);
    expect(items.map((i) => i.title)).toContain("Request the CIM");
    expect(hasChecklist("nda_signed")).toBe(true);
  });

  it("terminal stages have no checklist", () => {
    expect(checklistForStage("won")).toEqual([]);
    expect(checklistForStage("passed")).toEqual([]);
    expect(hasChecklist("won")).toBe(false);
  });
});

describe("stagesWithChecklist", () => {
  it("lists only stages that ship a playbook", () => {
    const stages = stagesWithChecklist();
    expect(stages).toContain("cim_received");
    expect(stages).not.toContain("won");
    expect(stages.every(hasChecklist)).toBe(true);
  });
});

describe("suggestedTasks", () => {
  const anchor = "2026-06-21";

  it("computes due dates from the anchor + offset", () => {
    const tasks = suggestedTasks("nda_signed", anchor);
    const cim = tasks.find((t) => t.title === "Request the CIM")!;
    expect(cim.dueAt).toBe("2026-06-23"); // +2 days
  });

  it("skips items whose title already exists (case-insensitive)", () => {
    const tasks = suggestedTasks("nda_signed", anchor, ["request the cim"]);
    expect(tasks.map((t) => t.title)).not.toContain("Request the CIM");
    expect(tasks.length).toBe(checklistForStage("nda_signed").length - 1);
  });

  it("returns [] for a stage with no checklist", () => {
    expect(suggestedTasks("won", anchor)).toEqual([]);
  });

  it("returns dated YYYY-MM-DD strings", () => {
    for (const t of suggestedTasks("due_diligence", anchor)) {
      expect(t.dueAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });
});
