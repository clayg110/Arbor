import { describe, it, expect } from "vitest";
import { parseNlQuery } from "@/lib/nl-search";

describe("parseNlQuery", () => {
  it("empty string returns empty result", () => {
    expect(parseNlQuery("")).toEqual({});
  });

  it("plain company name passes through as text", () => {
    expect(parseNlQuery("Dow Chemical")).toEqual({ text: "Dow Chemical" });
  });

  it("sector keyword: chemicals", () => {
    expect(parseNlQuery("chemicals")).toMatchObject({ sector: "chemicals" });
  });

  it("sector keyword: aerospace defense (multi-word)", () => {
    expect(parseNlQuery("aerospace defense")).toMatchObject({
      sector: "aerospace_defense",
    });
  });

  it("sector keyword: specialty materials (multi-word)", () => {
    expect(parseNlQuery("specialty materials in market")).toMatchObject({
      sector: "specialty_materials",
      stage: "in_market",
    });
  });

  it("deal type: carveout", () => {
    expect(parseNlQuery("carveouts")).toMatchObject({ dealType: "carveout" });
  });

  it("deal type: carve-out hyphen variant", () => {
    expect(parseNlQuery("carve-out")).toMatchObject({ dealType: "carveout" });
  });

  it("deal type: private asset (multi-word)", () => {
    expect(parseNlQuery("private asset")).toMatchObject({ dealType: "private_asset" });
  });

  it("stage: in market", () => {
    expect(parseNlQuery("in market")).toMatchObject({ stage: "in_market" });
  });

  it("stage: monitor", () => {
    expect(parseNlQuery("monitor")).toMatchObject({ stage: "monitor_for_exit" });
  });

  it("stage: on hold", () => {
    expect(parseNlQuery("on hold")).toMatchObject({ stage: "on_hold" });
  });

  it("stage: pulled", () => {
    expect(parseNlQuery("pulled chemicals")).toMatchObject({
      stage: "pulled",
      sector: "chemicals",
    });
  });

  it("confidence: high", () => {
    expect(parseNlQuery("high")).toMatchObject({ confidence: "high" });
  });

  it("confidence: needs review (multi-word)", () => {
    expect(parseNlQuery("needs review")).toMatchObject({ confidence: "needs_review" });
  });

  it("conviction band: hot", () => {
    expect(parseNlQuery("hot")).toMatchObject({ convictionBand: "hot" });
  });

  it("conviction band: heating up", () => {
    expect(parseNlQuery("heating up")).toMatchObject({ convictionBand: "hot" });
  });

  it("compound query: sector + deal type + stage", () => {
    const r = parseNlQuery("chemicals carveouts in market");
    expect(r).toMatchObject({
      sector: "chemicals",
      dealType: "carveout",
      stage: "in_market",
    });
    expect(r.text).toBeUndefined();
  });

  it("compound query: sector + confidence + free text", () => {
    const r = parseNlQuery("high confidence industrials Acme");
    expect(r).toMatchObject({ confidence: "high", sector: "industrials", text: "Acme" });
  });

  it("unknown text preserved after keyword extraction", () => {
    const r = parseNlQuery("in market Chem Corp");
    expect(r.stage).toBe("in_market");
    expect(r.text).toBe("Chem Corp");
  });

  it("case insensitive", () => {
    expect(parseNlQuery("CHEMICALS HIGH IN MARKET")).toMatchObject({
      sector: "chemicals",
      confidence: "high",
      stage: "in_market",
    });
  });

  it("does not double-match when phrase contained in longer phrase", () => {
    // "monitor for exit" should take precedence over bare "monitor"
    const r = parseNlQuery("monitor for exit");
    expect(r.stage).toBe("monitor_for_exit");
    expect(r.text).toBeUndefined();
  });
});
