import { randomBytes } from "crypto";
import { createServiceClient } from "@/lib/supabase/server";
import { ok, fail, requireBackend, serverError } from "@/lib/api/respond";
import { requireAdmin } from "@/lib/api/auth";
import { hashKey } from "@/lib/api-keys";
import { auditAs } from "@/lib/audit";

// POST /api/admin/scim-token — (re)generate the org's SCIM bearer token. Shown
// once; only the hash is stored. Configure it in your IdP's SCIM settings.
export async function POST() {
  const guard = requireBackend();
  if (guard) return guard;
  const gate = await requireAdmin();
  if (gate.res) return gate.res;
  if (!gate.user.orgId) return fail("Create an organization first");

  const token = `scim_${randomBytes(24).toString("hex")}`;
  const svc = createServiceClient();
  const { error } = await svc
    .from("orgs")
    .update({ scim_token_hash: hashKey(token) })
    .eq("id", gate.user.orgId);
  if (error) return serverError(error);

  await auditAs(gate.user, "scim.token_generate", {
    entityType: "org",
    entityId: gate.user.orgId,
  });

  // SCIM base URL to paste into the IdP, alongside the token.
  return ok({ token, scimBaseUrl: "/api/scim/v2" });
}
