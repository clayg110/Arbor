// Pure helpers for the contact / banker relationship layer. No I/O.

export type ContactRole = "M&A Advisor" | "CFO" | "CEO" | "Partner" | "Counsel" | "Other";

export const CONTACT_ROLES: ContactRole[] = [
  "M&A Advisor",
  "CFO",
  "CEO",
  "Partner",
  "Counsel",
  "Other",
];

export interface Contact {
  id: string;
  name: string;
  title: string | null;
  firm: string | null;
  email: string | null;
  phone: string | null;
  linkedinUrl: string | null;
  notes: string | null;
  createdAt: string;
}

// A contact as attached to a specific company (carries the join-row id + role).
export interface CompanyContact extends Contact {
  linkId: string;
  role: ContactRole;
}

// Banker-intelligence row: one firm, how many live processes it advises on.
export interface FirmActivity {
  firm: string;
  processCount: number;
  contacts: number;
}

export function roleColor(role: ContactRole): { bg: string; text: string } {
  switch (role) {
    case "M&A Advisor":
      return { bg: "#eff6ff", text: "#1d4ed8" };
    case "CFO":
    case "CEO":
      return { bg: "#f0fdf4", text: "#157A5A" };
    case "Partner":
      return { bg: "#fdf4ff", text: "#7e22ce" };
    case "Counsel":
      return { bg: "#fefce8", text: "#854d0e" };
    default:
      return { bg: "#f1f5f9", text: "#475569" };
  }
}

export function contactInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

// Group company-contact links into firm activity, counting how many distinct
// companies each M&A-advisor firm is engaged on. `links` pairs a companyId with
// the contact's firm + role.
export function bankerIntelligence(
  links: { companyId: string; firm: string | null; role: ContactRole }[]
): FirmActivity[] {
  const byFirm = new Map<string, { processes: Set<string>; contacts: number }>();
  for (const l of links) {
    if (l.role !== "M&A Advisor" || !l.firm) continue;
    const key = l.firm.trim();
    if (!key) continue;
    const entry = byFirm.get(key) ?? { processes: new Set<string>(), contacts: 0 };
    entry.processes.add(l.companyId);
    entry.contacts += 1;
    byFirm.set(key, entry);
  }
  return [...byFirm.entries()]
    .map(([firm, e]) => ({
      firm,
      processCount: e.processes.size,
      contacts: e.contacts,
    }))
    .sort((a, b) => b.processCount - a.processCount || a.firm.localeCompare(b.firm));
}

const ADVISOR_VERBS = "engaged|hired|mandated|retained|appointed";
// Firm phrase: a run of Capitalized tokens (allowing . & and lowercase joiners
// like "of"/"and" inside, but anchored on capitalized words).
const FIRM = "[A-Z][\\w.&]*(?:\\s+[A-Z][\\w.&]*){0,3}";
const ADVISOR_RE = new RegExp(
  `\\b(${FIRM})(?:\\s+and\\s+(${FIRM}))?\\s+(?:has been |have been |were |was |is |are )?(?:${ADVISOR_VERBS})\\b`,
  "g"
);

// Words that look like firms but aren't, when they lead a sentence before a verb.
const STOPWORDS = new Set([
  "The",
  "A",
  "An",
  "It",
  "They",
  "He",
  "She",
  "We",
  "This",
  "That",
  "Management",
  "Sponsor",
  "Company",
]);

// Heuristic: pull candidate advisor firm names out of signal excerpts. Returns
// firm names not already present (case-insensitive) in `existingFirms`. Pure —
// the LLM-backed version can replace this later; this keeps the suggestion
// dormant-safe with no external call.
export function suggestAdvisorsFromSignals(
  excerpts: string[],
  existingFirms: string[] = []
): string[] {
  const have = new Set(existingFirms.map((f) => f.trim().toLowerCase()));
  const found = new Map<string, string>(); // lowercased -> display
  for (const text of excerpts) {
    if (!text) continue;
    ADVISOR_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = ADVISOR_RE.exec(text)) !== null) {
      for (const raw of [m[1], m[2]]) {
        if (!raw) continue;
        const firm = raw.trim();
        if (STOPWORDS.has(firm)) continue;
        const key = firm.toLowerCase();
        if (have.has(key) || found.has(key)) continue;
        found.set(key, firm);
      }
    }
  }
  return [...found.values()];
}
