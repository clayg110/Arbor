// API key generation + verification for the public API (/api/v1/*).
// The full key is shown to the user exactly once at creation; only its sha256
// hash is stored. Format: arbor_<8 hex prefix>_<43-char base64url secret>.

import { createHash, randomBytes } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/db";

type Svc = SupabaseClient<Database>;

export interface GeneratedKey {
  plaintext: string; // returned once, never persisted
  prefix: string; // stored + shown in the UI
  hash: string; // stored
}

export function hashKey(plaintext: string): string {
  return createHash("sha256").update(plaintext).digest("hex");
}

export function generateApiKey(): GeneratedKey {
  const prefix = `arbor_${randomBytes(4).toString("hex")}`;
  const secret = randomBytes(32).toString("base64url");
  const plaintext = `${prefix}_${secret}`;
  return { plaintext, prefix, hash: hashKey(plaintext) };
}

// Pull a bearer token out of an Authorization header (or null).
export function bearerFrom(header: string | null): string | null {
  if (!header) return null;
  const m = header.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : null;
}

export interface VerifiedKey {
  keyId: string;
  orgId: string;
}

// Verify a presented key against the store. Rejects revoked keys. On success,
// bumps last_used_at (best-effort) and returns the owning org. Requires a
// service-role client (api_keys is not client-readable).
export async function verifyApiKey(svc: Svc, plaintext: string): Promise<VerifiedKey | null> {
  if (!plaintext.startsWith("arbor_")) return null;
  const hash = hashKey(plaintext);

  const { data, error } = await svc
    .from("api_keys")
    .select("id, org_id, revoked_at")
    .eq("key_hash", hash)
    .maybeSingle();

  if (error || !data || data.revoked_at) return null;

  void svc.from("api_keys").update({ last_used_at: new Date().toISOString() }).eq("id", data.id);

  return { keyId: data.id, orgId: data.org_id };
}
