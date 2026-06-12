import { describe, it, expect } from "vitest";
import { domainFromWebsite, toCrmOrg, crmNoteText, type CrmCompany } from "@/lib/crm/map";

function company(p: Partial<CrmCompany> = {}): CrmCompany {
  return {
    id: "c1",
    name: "Acme Polyurethanes",
    sector: "chemicals",
    dealType: "carveout",
    stage: "in_market",
    confidence: "high",
    sponsorFirm: null,
    parentCompany: "Acme Inc.",
    description: "Polyurethanes unit under strategic review.",
    ourProcessStage: "first_round_bid",
    website: "https://www.acme.com/about",
    ...p,
  };
}

describe("domainFromWebsite", () => {
  it("extracts a bare host and strips www", () => {
    expect(domainFromWebsite("https://www.acme.com/about")).toBe("acme.com");
  });
  it("adds a scheme when missing", () => {
    expect(domainFromWebsite("acme.com")).toBe("acme.com");
  });
  it("returns null for empty / invalid", () => {
    expect(domainFromWebsite(null)).toBeNull();
    expect(domainFromWebsite("   ")).toBeNull();
    expect(domainFromWebsite("not a url with spaces")).toBeNull();
  });
});

describe("toCrmOrg", () => {
  it("maps name + derived domain", () => {
    expect(toCrmOrg(company())).toEqual({
      name: "Acme Polyurethanes",
      domain: "acme.com",
    });
  });
  it("null domain when no website", () => {
    expect(toCrmOrg(company({ website: null })).domain).toBeNull();
  });
});

describe("crmNoteText", () => {
  it("summarizes the deal state with labels", () => {
    const note = crmNoteText(company());
    expect(note).toContain("Arbor deal sync — Acme Polyurethanes");
    expect(note).toContain("Stage: In market");
    expect(note).toContain("Deal type: Carve-out");
    expect(note).toContain("Confidence: high");
    expect(note).toContain("Our process:");
    expect(note).toContain("Parent: Acme Inc.");
    expect(note).toContain("Polyurethanes unit under strategic review.");
  });

  it("labels sponsor for private-asset deals", () => {
    const note = crmNoteText(
      company({
        dealType: "private_asset",
        parentCompany: null,
        sponsorFirm: "SK Capital",
      })
    );
    expect(note).toContain("Deal type: Private asset");
    expect(note).toContain("Sponsor: SK Capital");
  });

  it("omits process line when there is no internal stage", () => {
    expect(crmNoteText(company({ ourProcessStage: null }))).not.toContain("Our process:");
  });
});
