import { type NextRequest } from "next/server";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/server";
import { ok, fail, requireBackend, serverError } from "@/lib/api/respond";
import { requireAdmin } from "@/lib/api/auth";
import { auditAs } from "@/lib/audit";
import { parseJson, roleEnum } from "@/lib/validation";
import { hasEmailEnv, sendEmail, inviteEmail } from "@/lib/email";
import { getSeatStatus } from "@/lib/seats";
import type { DbOrg } from "@/types/db";

const inviteSchema = z.object({
  email: z.string().email(),
  role: roleEnum.optional(),
  name: z.string().trim().max(120).optional(),
});

// POST /api/admin/invite — { email, role?, name? }
// Provisions a pending user, attaches them to the admin's org, and emails an
// accept link. Uses generateLink (no Supabase SMTP dependency) so the link is
// delivered through our own transport. When email is unconfigured, the link is
// returned to the admin so they can share it manually (admin-only endpoint).
export async function POST(request: NextRequest) {
  const guard = requireBackend();
  if (guard) return guard;
  const gate = await requireAdmin();
  if (gate.res) return gate.res;

  const parsed = await parseJson(request, inviteSchema);
  if (!parsed.ok) return parsed.res;
  const { email, role = "analyst", name } = parsed.data;

  const svc = createServiceClient();

  const seats = await getSeatStatus(svc, gate.user.orgId);
  if (seats.full) {
    return fail(
      "Seat limit reached — upgrade your plan or add seats to invite more.",
      403
    );
  }
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? request.nextUrl.origin;

  const { data: link, error: linkErr } = await svc.auth.admin.generateLink({
    type: "invite",
    email,
    options: {
      data: { role, name: name ?? email.split("@")[0] },
      redirectTo: `${appUrl}/auth/callback`,
    },
  });
  if (linkErr || !link?.user) {
    // Most common cause: a user with this email already exists.
    return fail(linkErr?.message ?? "Could not create invite", 409);
  }

  // Attach to the admin's org + role (app_metadata is not user-editable and
  // rides in the JWT for org-scoped RLS).
  const { error: updErr } = await svc.auth.admin.updateUserById(link.user.id, {
    app_metadata: gate.user.orgId ? { org_id: gate.user.orgId } : {},
    user_metadata: {
      ...(link.user.user_metadata ?? {}),
      role,
      name: name ?? email.split("@")[0],
    },
  });
  if (updErr) return serverError(updErr);

  // Resolve org name for the email (fallback "Arbor" in single-tenant mode).
  let orgName = "Arbor";
  if (gate.user.orgId) {
    const { data: org } = await svc
      .from("orgs")
      .select("name")
      .eq("id", gate.user.orgId)
      .maybeSingle();
    orgName = (org as Pick<DbOrg, "name"> | null)?.name ?? orgName;
  }

  const actionLink = link.properties?.action_link ?? "";
  const mail = inviteEmail({ orgName, inviterEmail: gate.user.email, actionLink });
  const sent = await sendEmail({ to: email, ...mail });

  await auditAs(gate.user, "user.invite", {
    entityType: "user",
    entityId: link.user.id,
    metadata: { email, role, emailed: sent.ok },
  });

  return ok({
    ok: true,
    userId: link.user.id,
    emailed: sent.ok,
    // Only surface the raw link when we couldn't email it (dev / unconfigured).
    actionLink: hasEmailEnv() ? undefined : actionLink,
  });
}
