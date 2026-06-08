// Server-side SCIM helpers: resolve the calling org from its bearer token, and
// map a Supabase auth user to the SCIM input shape.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { User } from "@supabase/supabase-js";
import type { Database } from "@/types/db";
import { bearerFrom, hashKey } from "@/lib/api-keys";
import type { ScimUserInput } from "@/lib/scim";

// Bearer token → owning org id (matched on the stored sha256 hash). Null when
// missing / unknown (→ 401).
export async function resolveScimOrg(
  svc: SupabaseClient<Database>,
  authHeader: string | null
): Promise<string | null> {
  const token = bearerFrom(authHeader);
  if (!token) return null;
  const { data } = await svc
    .from("orgs")
    .select("id")
    .eq("scim_token_hash", hashKey(token))
    .maybeSingle();
  return (data as { id: string } | null)?.id ?? null;
}

export function userIsActive(u: Pick<User, "banned_until">): boolean {
  const banned = (u as { banned_until?: string | null }).banned_until;
  return !(banned && Date.parse(banned) > Date.now());
}

export function userToScimInput(u: User): ScimUserInput {
  return {
    id: u.id,
    email: u.email ?? "",
    name: (u.user_metadata?.name as string) ?? null,
    active: userIsActive(u),
  };
}

export function orgIdOf(u: User): string | undefined {
  return u.app_metadata?.org_id as string | undefined;
}
