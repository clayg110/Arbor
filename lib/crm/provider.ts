// Provider-neutral CRM contract. Each CRM (Affinity today; DealCloud/Salesforce
// later) implements this. One-way for now: push an Arbor deal out to the CRM.

import type { CrmCompany } from "./map";

export interface CrmPushResult {
  ok: boolean;
  externalId: string | null; // CRM's organization id on success
  error: string | null;
}

export interface CrmProvider {
  // Stable machine name persisted in crm_sync.provider.
  name: string;
  // Human label for the UI.
  label: string;
  pushCompany(company: CrmCompany): Promise<CrmPushResult>;
}
