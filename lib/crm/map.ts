// Pure mapping: an Arbor deal → CRM-neutral organization payload + a human note.
// No I/O, no provider specifics — every CRM provider consumes these shapes. Kept
// separate from the HTTP layer so it is fully unit-testable.

import { STAGE_LABELS } from "@/lib/colors";
import { PROCESS_STAGE_LABELS, type OurProcessStage } from "@/lib/process-stage";
import type { Stage, Confidence, Sector, DealType } from "@/lib/types";

// Minimal deal fields the CRM push needs (subset of a company row).
export interface CrmCompany {
  id: string;
  name: string;
  sector: Sector;
  dealType: DealType;
  stage: Stage;
  confidence: Confidence;
  sponsorFirm: string | null;
  parentCompany: string | null;
  description: string | null;
  ourProcessStage: OurProcessStage | null;
  website: string | null;
}

export interface CrmOrgPayload {
  name: string;
  domain: string | null; // bare host, e.g. "acme.com"
}

// Best-effort domain from a website URL (CRMs key organizations on domain).
export function domainFromWebsite(website: string | null): string | null {
  if (!website) return null;
  const trimmed = website.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`);
    return url.hostname.replace(/^www\./, "") || null;
  } catch {
    return null;
  }
}

export function toCrmOrg(c: CrmCompany): CrmOrgPayload {
  return { name: c.name, domain: domainFromWebsite(c.website) };
}

// A concise activity note capturing the current deal state, written into the CRM
// so a banker opening the org record sees Arbor's read at a glance.
export function crmNoteText(c: CrmCompany): string {
  const lines: string[] = [];
  lines.push(`Arbor deal sync — ${c.name}`);
  lines.push(`Stage: ${STAGE_LABELS[c.stage] ?? c.stage}`);
  lines.push(`Deal type: ${c.dealType === "carveout" ? "Carve-out" : "Private asset"}`);
  lines.push(`Confidence: ${c.confidence}`);
  if (c.ourProcessStage) {
    lines.push(
      `Our process: ${PROCESS_STAGE_LABELS[c.ourProcessStage] ?? c.ourProcessStage}`
    );
  }
  const counterparty = c.sponsorFirm ?? c.parentCompany;
  if (counterparty) {
    lines.push(`${c.dealType === "carveout" ? "Parent" : "Sponsor"}: ${counterparty}`);
  }
  if (c.description) lines.push("", c.description);
  return lines.join("\n");
}
