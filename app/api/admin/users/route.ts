import { type NextRequest } from "next/server";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/server";
import { ok, fail, requireBackend, serverError } from "@/lib/api/respond";
import { requireAdmin } from "@/lib/api/auth";
import { auditAs } from "@/lib/audit";
import { parseJson, roleEnum } from "@/lib/validation";
import { getSeatStatus } from "@/lib/seats";

const roleChangeSchema = z.object({ userId: z.string().min(1), role: roleEnum });
const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "min 8 chars").max(200),
  role: roleEnum.optional(),
  name: z.string().trim().max(120).optional(),
});

// GET /api/admin/users — admin only. Lists auth users via the service role.
export async function GET() {
  const guard = requireBackend();
  if (guard) return guard;
  const gate = await requireAdmin();
  if (gate.res) return gate.res;

  const svc = createServiceClient();
  const { data, error } = await svc.auth.admin.listUsers();
  if (error) return serverError(error);

  // Tenant isolation: an org admin only sees members of their own org. A
  // single-tenant admin (no org_id) sees everyone, preserving the old behavior.
  const orgId = gate.user.orgId;
  const visible = orgId
    ? data.users.filter((u) => (u.app_metadata?.org_id as string | undefined) === orgId)
    : data.users;

  const users = visible.map((u) => ({
    id: u.id,
    name: (u.user_metadata?.name as string) ?? u.email?.split("@")[0] ?? "—",
    email: u.email ?? "",
    role: (u.user_metadata?.role as string) ?? "analyst",
    lastActive: u.last_sign_in_at ?? null,
  }));

  return ok({ users });
}

// DELETE /api/admin/users?userId= — remove a member of the admin's org.
export async function DELETE(request: NextRequest) {
  const guard = requireBackend();
  if (guard) return guard;
  const gate = await requireAdmin();
  if (gate.res) return gate.res;

  const userId = request.nextUrl.searchParams.get("userId");
  if (!userId) return fail("userId required");
  if (userId === gate.user.id) return fail("You cannot remove yourself");

  const svc = createServiceClient();
  const { data: existing, error: getErr } = await svc.auth.admin.getUserById(userId);
  if (getErr) return serverError(getErr);

  // Cross-tenant guard: an org admin may only remove their own org's members.
  const targetOrg = existing.user?.app_metadata?.org_id as string | undefined;
  if (gate.user.orgId && targetOrg !== gate.user.orgId) {
    return fail("User is not a member of your organization", 403);
  }

  const { error } = await svc.auth.admin.deleteUser(userId);
  if (error) return serverError(error);

  await auditAs(gate.user, "user.delete", {
    entityType: "user",
    entityId: userId,
    metadata: { email: existing.user?.email },
  });

  return ok({ ok: true, userId });
}

// PATCH /api/admin/users — { userId, role } change a user's role.
export async function PATCH(request: NextRequest) {
  const guard = requireBackend();
  if (guard) return guard;
  const gate = await requireAdmin();
  if (gate.res) return gate.res;

  const parsed = await parseJson(request, roleChangeSchema);
  if (!parsed.ok) return parsed.res;
  const body = parsed.data;
  if (body.userId === gate.user.id && body.role !== "admin") {
    return fail("You cannot remove your own admin role");
  }

  const svc = createServiceClient();
  const { data: existing, error: getErr } = await svc.auth.admin.getUserById(body.userId);
  if (getErr) return serverError(getErr);

  // Cross-tenant guard: only mutate members of the admin's own org.
  const targetOrg = existing.user?.app_metadata?.org_id as string | undefined;
  if (gate.user.orgId && targetOrg !== gate.user.orgId) {
    return fail("User is not a member of your organization", 403);
  }

  const { error } = await svc.auth.admin.updateUserById(body.userId, {
    user_metadata: { ...(existing.user?.user_metadata ?? {}), role: body.role },
  });
  if (error) return serverError(error);

  await auditAs(gate.user, "user.role_change", {
    entityType: "user",
    entityId: body.userId,
    metadata: { role: body.role },
  });

  return ok({ ok: true, userId: body.userId, role: body.role });
}

// POST /api/admin/users — { email, password, role?, name? } create a user.
export async function POST(request: NextRequest) {
  const guard = requireBackend();
  if (guard) return guard;
  const gate = await requireAdmin();
  if (gate.res) return gate.res;

  const parsed = await parseJson(request, createUserSchema);
  if (!parsed.ok) return parsed.res;
  const body = parsed.data;
  const role = body.role ?? "analyst";

  const svc = createServiceClient();

  const seats = await getSeatStatus(svc, gate.user.orgId);
  if (seats.full) {
    return fail("Seat limit reached — upgrade your plan or add seats.", 403);
  }

  const { data, error } = await svc.auth.admin.createUser({
    email: body.email,
    password: body.password,
    email_confirm: true,
    user_metadata: { role, name: body.name?.trim() || body.email.split("@")[0] },
    // New users inherit the creating admin's org (membership/invite). app_metadata
    // is not user-editable and rides in the JWT for org-scoped RLS.
    app_metadata: gate.user.orgId ? { org_id: gate.user.orgId } : {},
  });
  if (error) return serverError(error);

  await auditAs(gate.user, "user.create", {
    entityType: "user",
    entityId: data.user.id,
    metadata: { email: body.email, role },
  });

  const u = data.user;
  return ok({
    user: {
      id: u.id,
      name: (u.user_metadata?.name as string) ?? "—",
      email: u.email ?? "",
      role,
      lastActive: null,
    },
  });
}
