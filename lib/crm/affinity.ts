// Affinity CRM provider. Dormant without AFFINITY_API_KEY. Pushes an Arbor deal
// as an Affinity organization, then attaches a note with the current deal state.
// Affinity auth is HTTP Basic with an empty username and the API key as password.
// Network errors never throw to the caller — they surface as { ok: false }.

import { toCrmOrg, crmNoteText, type CrmCompany } from "./map";
import type { CrmProvider, CrmPushResult } from "./provider";

const BASE = "https://api.affinity.co";
const TIMEOUT_MS = 10_000;

export function hasAffinityEnv(): boolean {
  return !!process.env.AFFINITY_API_KEY;
}

function authHeader(): string {
  return "Basic " + Buffer.from(`:${process.env.AFFINITY_API_KEY}`).toString("base64");
}

export const affinityProvider: CrmProvider = {
  name: "affinity",
  label: "Affinity",

  async pushCompany(company: CrmCompany): Promise<CrmPushResult> {
    const org = toCrmOrg(company);
    try {
      const orgRes = await fetch(`${BASE}/organizations`, {
        method: "POST",
        headers: {
          Authorization: authHeader(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: org.name,
          domain: org.domain ?? undefined,
        }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!orgRes.ok) {
        return {
          ok: false,
          externalId: null,
          error: `Affinity organization create failed (${orgRes.status})`,
        };
      }
      const orgJson = (await orgRes.json()) as { id?: number };
      const externalId = orgJson.id != null ? String(orgJson.id) : null;

      // Best-effort note — a failed note doesn't fail the sync (org exists).
      if (externalId) {
        try {
          await fetch(`${BASE}/notes`, {
            method: "POST",
            headers: {
              Authorization: authHeader(),
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              organization_ids: [Number(externalId)],
              content: crmNoteText(company),
            }),
            signal: AbortSignal.timeout(TIMEOUT_MS),
          });
        } catch {
          // note is non-critical
        }
      }

      return { ok: true, externalId, error: null };
    } catch (e) {
      return {
        ok: false,
        externalId: null,
        error: e instanceof Error ? e.message : "Affinity push failed",
      };
    }
  },
};
