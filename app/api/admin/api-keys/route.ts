import { type NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { ok, fail, requireBackend, serverError } from "@/lib/api/respond";
import { requireAdmin } from "@/lib/api/auth";
import { generateApiKey } from "@/lib/api-keys";
import { auditAs } from "@/lib/audit";
import type { DbApiKey } from "@/types/db";

function publicView(k: DbApiKey) {
  return {
    id: k.id,
    name: k.name,
    prefix: k.key_prefix,
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

  let body: { name?: string };
  try {
    body = await request.json();
  } catch {
    return fail("Invalid JSON body");
  }
  const name = body.name?.trim();
  if (!name) return fail("name required");

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
    })
    .select("*")
    .single();
  if (error) return serverError(error);

  await auditAs(gate.user, "api_key.create", {
    entityType: "api_key",
    entityId: (data as DbApiKey).id,
    metadata: { name },
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
