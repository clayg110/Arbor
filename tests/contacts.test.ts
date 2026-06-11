import { describe, it, expect } from "vitest";
import {
  CONTACT_ROLES,
  roleColor,
  contactInitials,
  bankerIntelligence,
  suggestAdvisorsFromSignals,
  type ContactRole,
} from "@/lib/contacts";
import { toContact, toCompanyContact } from "@/lib/adapters/contacts";
import type { DbContact, DbCompanyContact } from "@/types/db";

describe("CONTACT_ROLES", () => {
  it("has the six expected roles", () => {
    expect(CONTACT_ROLES).toEqual([
      "M&A Advisor",
      "CFO",
      "CEO",
      "Partner",
      "Counsel",
      "Other",
    ]);
  });
});

describe("roleColor", () => {
  it("returns bg + text for every role", () => {
    for (const r of CONTACT_ROLES) {
      const c = roleColor(r);
      expect(c.bg).toMatch(/^#/);
      expect(c.text).toMatch(/^#/);
    }
  });

  it("gives advisors a distinct color from execs", () => {
    expect(roleColor("M&A Advisor")).not.toEqual(roleColor("CFO"));
  });
});

describe("contactInitials", () => {
  it("uses first + last initial", () => {
    expect(contactInitials("Daniel Reyes")).toBe("DR");
  });
  it("handles single name", () => {
    expect(contactInitials("Cher")).toBe("CH");
  });
  it("ignores extra whitespace and middle names", () => {
    expect(contactInitials("  Mary Jane Watson ")).toBe("MW");
  });
  it("falls back to ? for empty", () => {
    expect(contactInitials("   ")).toBe("?");
  });
});

describe("bankerIntelligence", () => {
  it("counts distinct processes per advisor firm", () => {
    const result = bankerIntelligence([
      { companyId: "1", firm: "Goldman Sachs", role: "M&A Advisor" },
      { companyId: "2", firm: "Goldman Sachs", role: "M&A Advisor" },
      { companyId: "1", firm: "Jefferies", role: "M&A Advisor" },
    ]);
    expect(result).toEqual([
      { firm: "Goldman Sachs", processCount: 2, contacts: 2 },
      { firm: "Jefferies", processCount: 1, contacts: 1 },
    ]);
  });

  it("dedupes processes when one firm has two contacts on the same deal", () => {
    const result = bankerIntelligence([
      { companyId: "1", firm: "Goldman Sachs", role: "M&A Advisor" },
      { companyId: "1", firm: "Goldman Sachs", role: "M&A Advisor" },
    ]);
    expect(result).toEqual([{ firm: "Goldman Sachs", processCount: 1, contacts: 2 }]);
  });

  it("ignores non-advisor roles and null firms", () => {
    const result = bankerIntelligence([
      { companyId: "1", firm: "Sachem", role: "CFO" },
      { companyId: "1", firm: null, role: "M&A Advisor" },
      { companyId: "2", firm: "Jefferies", role: "M&A Advisor" },
    ]);
    expect(result).toEqual([{ firm: "Jefferies", processCount: 1, contacts: 1 }]);
  });

  it("sorts by process count desc then name", () => {
    const result = bankerIntelligence([
      { companyId: "1", firm: "Zebra Advisors", role: "M&A Advisor" },
      { companyId: "2", firm: "Alpha Bank", role: "M&A Advisor" },
    ]);
    expect(result.map((f) => f.firm)).toEqual(["Alpha Bank", "Zebra Advisors"]);
  });

  it("returns empty for no advisor links", () => {
    expect(bankerIntelligence([])).toEqual([]);
  });
});

describe("suggestAdvisorsFromSignals", () => {
  it("extracts firms from 'X and Y engaged as advisors'", () => {
    const r = suggestAdvisorsFromSignals([
      "Goldman Sachs and Morgan Stanley engaged as advisors to explore alternatives.",
    ]);
    expect(r).toContain("Goldman Sachs");
    expect(r).toContain("Morgan Stanley");
  });

  it("extracts a single firm from 'X mandated to run'", () => {
    const r = suggestAdvisorsFromSignals([
      "Jefferies mandated to run formal sale process.",
    ]);
    expect(r).toEqual(["Jefferies"]);
  });

  it("extracts from 'hired'", () => {
    const r = suggestAdvisorsFromSignals(["Houlihan Lokey hired to run sale process."]);
    expect(r).toEqual(["Houlihan Lokey"]);
  });

  it("excludes firms already on record (case-insensitive)", () => {
    const r = suggestAdvisorsFromSignals(
      ["Goldman Sachs engaged as advisor."],
      ["goldman sachs"]
    );
    expect(r).toEqual([]);
  });

  it("dedupes repeated firms across excerpts", () => {
    const r = suggestAdvisorsFromSignals([
      "Jefferies mandated to run sale.",
      "Jefferies retained for the process.",
    ]);
    expect(r).toEqual(["Jefferies"]);
  });

  it("ignores sentence-leading stopwords", () => {
    const r = suggestAdvisorsFromSignals(["The board hired no one yet."]);
    expect(r).not.toContain("The");
  });

  it("returns empty when no advisor language present", () => {
    expect(suggestAdvisorsFromSignals(["Revenue grew 12% last quarter."])).toEqual([]);
  });

  it("skips empty excerpts", () => {
    expect(suggestAdvisorsFromSignals(["", ""])).toEqual([]);
  });
});

describe("ContactRole type", () => {
  it("CONTACT_ROLES members are assignable to ContactRole", () => {
    const r: ContactRole = CONTACT_ROLES[0];
    expect(r).toBe("M&A Advisor");
  });
});

describe("adapters", () => {
  const row: DbContact = {
    id: "ct1",
    org_id: "org1",
    created_by: "u1",
    name: "Daniel Reyes",
    title: "MD",
    firm: "Goldman Sachs",
    email: "d@gs.example",
    phone: "+1",
    linkedin_url: "https://linkedin.com/in/dr",
    notes: "lead banker",
    created_at: "2026-03-18",
  };

  it("toContact maps snake_case → camelCase", () => {
    expect(toContact(row)).toEqual({
      id: "ct1",
      name: "Daniel Reyes",
      title: "MD",
      firm: "Goldman Sachs",
      email: "d@gs.example",
      phone: "+1",
      linkedinUrl: "https://linkedin.com/in/dr",
      notes: "lead banker",
      createdAt: "2026-03-18",
    });
  });

  it("toCompanyContact adds linkId + role", () => {
    const link: DbCompanyContact = {
      id: "lc1",
      company_id: "1",
      contact_id: "ct1",
      org_id: "org1",
      role: "M&A Advisor",
      created_at: "2026-03-19",
    };
    const cc = toCompanyContact(link, row);
    expect(cc.linkId).toBe("lc1");
    expect(cc.role).toBe("M&A Advisor");
    expect(cc.name).toBe("Daniel Reyes");
  });
});
