import { type NextRequest } from "next/server";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/server";
import { ok, fail, requireBackend, serverError } from "@/lib/api/respond";
import { requireAdmin } from "@/lib/api/auth";
import { generateApiKey } from "@/lib/api-keys";
import { auditAs } from "@/lib/audit";
import { parseJson } from "@/lib/validation";
import type { DbApiKey } from "@/types/db";

const createSchema = z.object({
  name: z.string().trim().min(1, "required").max(80),
  expiresInDays: z.number().int().positive().max(3650).optional(),
  scopes: z.array(z.string().max(40)).max(20).optional(),
});

function publicView(k: DbApiKey) {
  return {
    id: k.id,
    name: k.name,
    prefix: k.key_prefix,
    scopes: k.scopes ?? [],
    expiresAt: k.expires_at,
    lastUsedAt: k.last_used_at,
    revokedAt: k.revoked_at,
    createdAt: k.created_at,
  };
}

// GET /api/admin/api-keys — list the org's keys (no plaintext, ever).
export async function GET() {
  const guard = requireBackend();
  if (guard) return guard;
  const gate = await requireAdmin();
  if (gate.res) return gate.res;
  if (!gate.user.orgId) return fail("No organization assigned", 409);

  const svc = createServiceClient();
  const { data, error } = await svc
    .from("api_keys")
    .select("*")
    .eq("org_id", gate.user.orgId)
    .order("created_at", { ascending: false });
  if (error) return serverError(error);

  return ok({ keys: (data ?? []).map((k) => publicView(k as DbApiKey)) });
}

// POST /api/admin/api-keys — { name } → create a key. Returns plaintext ONCE.
export async function POST(request: NextRequest) {
  const guard = requireBackend();
  if (guard) return guard;
  const gate = await requireAdmin();
  if (gate.res) return gate.res;
  if (!gate.user.orgId) return fail("No organization assigned", 409);

  const parsed = await parseJson(request, createSchema);
  if (!parsed.ok) return parsed.res;
  const { name, expiresInDays, scopes } = parsed.data;

  const expiresAt = expiresInDays
    ? new Date(Date.now() + expiresInDays * 86_400_000).toISOString()
    : null;

  const key = generateApiKey();
  const svc = createServiceClient();
  const { data, error } = await svc
    .from("api_keys")
    .insert({
      org_id: gate.user.orgId,
      created_by: gate.user.id,
      name,
      key_prefix: key.prefix,
      key_hash: key.hash,
      scopes: scopes ?? [],
      expires_at: expiresAt,
    })
    .select("*")
    .single();
  if (error) return serverError(error);

  await auditAs(gate.user, "api_key.create", {
    entityType: "api_key",
    entityId: (data as DbApiKey).id,
    metadata: { name, expiresInDays: expiresInDays ?? null, scopes: scopes ?? [] },
  });

  // plaintext is returned here and never again
  return ok({ key: { ...publicView(data as DbApiKey), plaintext: key.plaintext } }, { status: 201 });
}

// DELETE /api/admin/api-keys?id= — revoke (soft) a key.
export async function DELETE(request: NextRequest) {
  const guard = requireBackend();
  if (guard) return guard;
  const gate = await requireAdmin();
  if (gate.res) return gate.res;
  if (!gate.user.orgId) return fail("No organization assigned", 409);

  const id = request.nextUrl.searchParams.get("id");
  if (!id) return fail("id required");

  const svc = createServiceClient();
  const { error } = await svc
    .from("api_keys")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", id)
    .eq("org_id", gate.user.orgId);
  if (error) return serverError(error);

  await auditAs(gate.user, "api_key.revoke", { entityType: "api_key", entityId: id });

  return ok({ ok: true, id });
}
