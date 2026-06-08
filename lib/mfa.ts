// MFA assurance-level logic. After a password sign-in, Supabase reports the
// session's current vs required assurance level; if the user has a verified
// factor, nextLevel is "aal2" while currentLevel is still "aal1" → step up.

export interface AssuranceLevel {
  currentLevel: string | null;
  nextLevel: string | null;
}

export function needsStepUp(aal: AssuranceLevel | null | undefined): boolean {
  return !!aal && aal.nextLevel === "aal2" && aal.currentLevel !== "aal2";
}
