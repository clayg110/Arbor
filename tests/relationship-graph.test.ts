import { describe, it, expect } from "vitest";
import {
  buildCoverageMap,
  coverageSummary,
  warmIntros,
  type GraphCompany,
  type GraphContact,
  type ContactLink,
} from "@/lib/relationship-graph";

const companies: GraphCompany[] = [
  { companyId: "1", name: "Dow Polyurethanes", owner: "Dow Inc.", stage: "in_market" },
  { companyId: "6", name: "Sachem", owner: "One Rock Capital", stage: "in_market" },
  {
    companyId: "9",
    name: "Altivia",
    owner: "One Rock Capital",
    stage: "monitor_for_exit",
  },
  { companyId: "12", name: "Braskem", owner: "Carlyle Group", stage: "on_hold" },
];

const contacts: GraphContact[] = [
  { id: "ct1", name: "Daniel Reyes", firm: "Goldman Sachs" },
  { id: "ct4", name: "Margaret Chen", firm: "Sachem" },
  { id: "cx", name: "Pat Owner", firm: "One Rock Capital" },
];

const links: ContactLink[] = [
  { contactId: "ct1", companyId: "1", role: "M&A Advisor" },
  { contactId: "ct4", companyId: "6", role: "CFO" },
];

describe("buildCoverageMap", () => {
  it("marks an owner covered when a contact works at that firm", () => {
    const rows = buildCoverageMap(companies, contacts);
    const oneRock = rows.find((r) => r.owner === "One Rock Capital")!;
    expect(oneRock.covered).toBe(true);
    expect(oneRock.coverageVia).toBe("firm");
    expect(oneRock.contacts.map((c) => c.id)).toContain("cx");
  });

  it("marks an owner covered via a deal link even without a firm match", () => {
    const rows = buildCoverageMap(companies, contacts, links);
    const dow = rows.find((r) => r.owner === "Dow Inc.")!;
    expect(dow.covered).toBe(true);
    expect(dow.coverageVia).toBe("deal");
    expect(dow.contacts.map((c) => c.id)).toContain("ct1");
  });

  it("flags an owner with active deals and no relationship as an uncovered gap", () => {
    const rows = buildCoverageMap(companies, contacts);
    const carlyle = rows.find((r) => r.owner === "Carlyle Group")!;
    expect(carlyle.covered).toBe(false);
    expect(carlyle.coverageVia).toBe("none");
  });

  it("aggregates company + active counts per owner", () => {
    const rows = buildCoverageMap(companies, contacts);
    const oneRock = rows.find((r) => r.owner === "One Rock Capital")!;
    expect(oneRock.companies).toBe(2);
    expect(oneRock.activeCompanies).toBe(2);
  });

  it("surfaces active uncovered gaps first", () => {
    // Dow (covered via firm? no contact at 'Dow Inc.') — uncovered, active → a gap.
    const rows = buildCoverageMap(companies, contacts);
    expect(rows[0]!.covered && rows[0]!.activeCompanies > 0).not.toBe(true);
    // the very first row should be an active gap
    expect(rows[0]!.covered).toBe(false);
    expect(rows[0]!.activeCompanies).toBeGreaterThan(0);
  });

  it("de-duplicates a contact reachable by both firm and deal link", () => {
    const dupLinks: ContactLink[] = [
      { contactId: "cx", companyId: "6", role: "Partner" },
    ];
    const rows = buildCoverageMap(companies, contacts, dupLinks);
    const oneRock = rows.find((r) => r.owner === "One Rock Capital")!;
    expect(oneRock.contacts.filter((c) => c.id === "cx")).toHaveLength(1);
  });
});

describe("coverageSummary", () => {
  it("counts owners, covered, and active gaps", () => {
    const rows = buildCoverageMap(companies, contacts, links);
    const s = coverageSummary(rows);
    expect(s.owners).toBe(3);
    expect(s.covered).toBeGreaterThanOrEqual(2);
    expect(s.coverageRatio).toBe(Math.round((s.covered / s.owners) * 100));
  });

  it("is empty-safe", () => {
    expect(coverageSummary([])).toEqual({
      owners: 0,
      covered: 0,
      activeGaps: 0,
      coverageRatio: 0,
    });
  });
});

describe("warmIntros", () => {
  it("ranks a direct M&A-advisor link above an inside-owner contact", () => {
    const intros = warmIntros(
      { companyId: "1", owner: "Dow Inc." },
      [...contacts, { id: "ct1", name: "Daniel Reyes", firm: "Goldman Sachs" }],
      links
    );
    expect(intros[0]!.kind).toBe("direct");
    expect(intros[0]!.contactId).toBe("ct1");
  });

  it("finds an inside-owner route by firm match", () => {
    const intros = warmIntros({ companyId: "6", owner: "One Rock Capital" }, contacts);
    const inside = intros.find((i) => i.kind === "inside_owner");
    expect(inside?.contactId).toBe("cx");
  });

  it("recognises a contact at an advising firm", () => {
    const intros = warmIntros(
      { companyId: "6", owner: "One Rock Capital", advisorFirms: ["Goldman Sachs"] },
      contacts
    );
    const advisor = intros.find((i) => i.kind === "advisor_firm");
    expect(advisor?.contactId).toBe("ct1");
  });

  it("keeps one row per contact, preferring the strongest route", () => {
    // ct4 is both at firm 'Sachem' (not the owner) and directly linked as CFO.
    const intros = warmIntros({ companyId: "6", owner: "Sachem" }, contacts, links);
    const chen = intros.filter((i) => i.contactId === "ct4");
    expect(chen).toHaveLength(1);
    // direct CFO (0.85) beats inside_owner (0.80)
    expect(chen[0]!.kind).toBe("direct");
  });

  it("returns nothing when no route exists", () => {
    expect(warmIntros({ companyId: "99", owner: "Unknown Holdings" }, contacts)).toEqual(
      []
    );
  });
});
