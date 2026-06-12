// CRM provider selection. The active provider is whichever integration has its
// key configured (Affinity today). Everything is dormant-until-key: with no CRM
// env, `getCrmProvider` returns null and the route/UI report "not configured".

import { affinityProvider, hasAffinityEnv } from "./affinity";
import type { CrmProvider } from "./provider";

export type { CrmProvider, CrmPushResult } from "./provider";
export type { CrmCompany } from "./map";

export function hasCrmEnv(): boolean {
  return hasAffinityEnv();
}

export function getCrmProvider(): CrmProvider | null {
  if (hasAffinityEnv()) return affinityProvider;
  return null;
}

// Human label of the active provider, or null when none is configured.
export function crmProviderLabel(): string | null {
  return getCrmProvider()?.label ?? null;
}
