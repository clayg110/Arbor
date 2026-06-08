import { createClient, createServiceClient } from "@/lib/supabase/server";
import { ok, fail, requireBackend, serverError } from "@/lib/api/respond";
import { getSessionUser } from "@/lib/api/auth";
import { auditAs } from "@/lib/audit";

// POST /api/account/delete — GDPR right to erasure. Deletes the requesting
// user's own personal data and account. Irreversible.
export async function POST() {
  const guard = requireBackend();
  if (guard) return guard;

  const user = await getSessionUser(await createClient());
  if (!user) return fail("Unauthorized", 401);

  const svc = createServiceClient();

  // Record the intent before the account disappears (audit is best-effort).
  await auditAs(user, "account.delete", { entityType: "user", entityId: user.id });

  // Remove tenant-private rows owned by the user (no FK cascade from auth.users).
  const notes = await svc.from("analyst_notes").delete().eq("user_id", user.id);
  if (notes.error) return serverError(notes.error);
  const watch = await svc.from("watchlist").delete().eq("user_id", user.id);
  if (watch.error) return serverError(watch.error);

  const { error } = await svc.auth.admin.deleteUser(user.id);
  if (error) return serverError(error);

  return ok({ ok: true });
}
