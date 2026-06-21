// Pure relationship-graph analytics over the contact network. Answers the two
// questions the relationship layer exists for: "which deal owners do we actually
// have a way into, and where are the gaps?" (coverage map) and "who do we know
// who can get us a warm intro to this deal?" (intro paths). No I/O — the page
// joins companies + contacts + company_contact links and passes them in.

import type { Stage } from "@/lib/types";
import type { ContactRole } from "@/lib/contacts";

export interface GraphCompany {
  companyId: string;
  name: string;
  owner: string; // sponsor (private asset) or parent (carveout)
  stage: Stage;
}

export interface GraphContact {
  id: string;
  name: string;
  firm: string | null;
  title?: string | null;
}

// A company_contacts join row: which contact is attached to which company, in
// what role. Optional input — coverage still works firm-to-firm without it.
export interface ContactLink {
  contactId: string;
  companyId: string;
  role: ContactRole;
}

const ACTIVE_STAGES: Stage[] = ["in_market", "monitor_for_exit"];

function normFirm(firm: string | null | undefined): string {
  return (firm ?? "").trim().toLowerCase();
}

// How much access each role buys when we already have a direct link to the deal.
const ROLE_WEIGHT: Record<ContactRole, number> = {
  "M&A Advisor": 0.9,
  CFO: 0.85,
  CEO: 0.85,
  Partner: 0.6,
  Counsel: 0.5,
  Other: 0.3,
};

export interface OwnerCoverage {
  owner: string;
  companies: number;
  activeCompanies: number;
  contacts: GraphContact[]; // contacts that give us a way in
  covered: boolean;
  coverageVia: "firm" | "deal" | "none";
}

// Per deal-owner (sponsor/parent): do we have any relationship that reaches
// inside — a contact at that firm, or a contact attached to one of its deals?
// Sorted so active, uncovered owners (the actionable gaps) surface first.
export function buildCoverageMap(
  companies: GraphCompany[],
  contacts: GraphContact[],
  links: ContactLink[] = []
): OwnerCoverage[] {
  const byOwner = new Map<string, GraphCompany[]>();
  for (const c of companies) {
    const key = c.owner.trim();
    if (!key) continue;
    const list = byOwner.get(key) ?? [];
    list.push(c);
    byOwner.set(key, list);
  }

  const contactsById = new Map(contacts.map((c) => [c.id, c]));

  const rows: OwnerCoverage[] = [];
  for (const [owner, owned] of byOwner.entries()) {
    const ownedIds = new Set(owned.map((c) => c.companyId));

    const firmContacts = contacts.filter((c) => normFirm(c.firm) === normFirm(owner));
    const dealContacts = links
      .filter((l) => ownedIds.has(l.companyId))
      .map((l) => contactsById.get(l.contactId))
      .filter((c): c is GraphContact => !!c);

    // Union, de-duplicated by contact id, preferring firm matches first.
    const seen = new Set<string>();
    const reach: GraphContact[] = [];
    for (const c of [...firmContacts, ...dealContacts]) {
      if (seen.has(c.id)) continue;
      seen.add(c.id);
      reach.push(c);
    }

    const coverageVia: OwnerCoverage["coverageVia"] =
      firmContacts.length > 0 ? "firm" : dealContacts.length > 0 ? "deal" : "none";

    rows.push({
      owner,
      companies: owned.length,
      activeCompanies: owned.filter((c) => ACTIVE_STAGES.includes(c.stage)).length,
      contacts: reach,
      covered: reach.length > 0,
      coverageVia,
    });
  }

  // Gaps first: uncovered owners with active deals, then by active-deal volume.
  return rows.sort((a, b) => {
    const aGap = !a.covered && a.activeCompanies > 0;
    const bGap = !b.covered && b.activeCompanies > 0;
    if (aGap !== bGap) return aGap ? -1 : 1;
    if (b.activeCompanies !== a.activeCompanies)
      return b.activeCompanies - a.activeCompanies;
    return a.owner.localeCompare(b.owner);
  });
}

export interface CoverageSummary {
  owners: number;
  covered: number;
  activeGaps: number; // active-deal owners with no relationship
  coverageRatio: number; // covered / owners, 0–100
}

export function coverageSummary(rows: OwnerCoverage[]): CoverageSummary {
  const owners = rows.length;
  const covered = rows.filter((r) => r.covered).length;
  const activeGaps = rows.filter((r) => !r.covered && r.activeCompanies > 0).length;
  return {
    owners,
    covered,
    activeGaps,
    coverageRatio: owners === 0 ? 0 : Math.round((covered / owners) * 100),
  };
}

export type IntroKind = "direct" | "inside_owner" | "advisor_firm";

export interface IntroPath {
  contactId: string;
  contactName: string;
  firm: string | null;
  score: number; // 0–100 strength of the route in
  reason: string;
  kind: IntroKind;
}

const INTRO_LABEL: Record<IntroKind, string> = {
  direct: "Direct contact on this deal",
  inside_owner: "Inside the owner",
  advisor_firm: "At an advising firm",
};

// Rank the people who could get us a warm introduction to a target deal:
//   • direct — already attached to this company (strongest, weighted by role),
//   • inside_owner — works at the owner (sponsor/parent),
//   • advisor_firm — works at a firm advising on the deal.
// One row per contact, keeping their strongest route.
export function warmIntros(
  target: { companyId: string; owner: string; advisorFirms?: string[] },
  contacts: GraphContact[],
  links: ContactLink[] = []
): IntroPath[] {
  const contactsById = new Map(contacts.map((c) => [c.id, c]));
  const advisorFirms = new Set((target.advisorFirms ?? []).map(normFirm));
  const best = new Map<string, IntroPath>();

  const consider = (c: GraphContact, kind: IntroKind, score: number, reason: string) => {
    const prev = best.get(c.id);
    if (prev && prev.score >= score) return;
    best.set(c.id, {
      contactId: c.id,
      contactName: c.name,
      firm: c.firm,
      score: Math.round(score * 100),
      reason,
      kind,
    });
  };

  // direct links to the target company
  for (const l of links) {
    if (l.companyId !== target.companyId) continue;
    const c = contactsById.get(l.contactId);
    if (!c) continue;
    consider(c, "direct", ROLE_WEIGHT[l.role], `${INTRO_LABEL.direct} (${l.role})`);
  }

  for (const c of contacts) {
    const firm = normFirm(c.firm);
    if (firm && firm === normFirm(target.owner)) {
      consider(c, "inside_owner", 0.8, `${INTRO_LABEL.inside_owner} — ${c.firm}`);
    } else if (firm && advisorFirms.has(firm)) {
      consider(c, "advisor_firm", 0.65, `${INTRO_LABEL.advisor_firm} — ${c.firm}`);
    }
  }

  return [...best.values()].sort(
    (a, b) => b.score - a.score || a.contactName.localeCompare(b.contactName)
  );
}
