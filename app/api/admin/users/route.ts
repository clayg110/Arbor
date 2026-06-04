import { NextResponse, type NextRequest } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { ok, fail, requireBackend } from "@/lib/api/respond";
import { getSessionUser, type SessionUser } from "@/lib/api/auth";

const ROLES = ["analyst", "admin"];

// Shared admin gate. `res` set → return it; otherwise `user` is the admin.
async function requireAdmin(): Promise<
  { res: NextResponse; user: null } | { res: null; user: SessionUser }
> {
  const supabase = createClient();
  const user = await getSessionUser(supabase);
  if (!user) return { res: fail("Unauthorized", 401), user: null };
  if (user.role !== "admin") return { res: fail("Forbidden", 403), user: null };
  return { res: null, user };
}

// GET /api/admin/users — admin only. Lists auth users via the service role.
export async function GET() {
  const guard = requireBackend();
  if (guard) return guard;
  const gate = await requireAdmin();
  if (gate.res) return gate.res;

  const svc = createServiceClient();
  const { data, error } = await svc.auth.admin.listUsers();
  if (error) return fail(error.message, 500);

  const users = data.users.map((u) => ({
    id: u.id,
    name: (u.user_metadata?.name as string) ?? u.email?.split("@")[0] ?? "—",
    email: u.email ?? "",
    role: (u.user_metadata?.role as string) ?? "analyst",
    lastActive: u.last_sign_in_at ?? null,
  }));

  return ok({ users });
}

// PATCH /api/admin/users — { userId, role } change a user's role.
export async function PATCH(request: NextRequest) {
  const guard = requireBackend();
  if (guard) return guard;
  const gate = await requireAdmin();
  if (gate.res) return gate.res;

  let body: { userId?: string; role?: string };
  try {
    body = await request.json();
  } catch {
    return fail("Invalid JSON body");
  }
  if (!body.userId || !body.role) return fail("userId and role required");
  if (!ROLES.includes(body.role)) return fail("Invalid role");
  if (body.userId === gate.user.id && body.role !== "admin") {
    return fail("You cannot remove your own admin role");
  }

  const svc = createServiceClient();
  const { data: existing, error: getErr } = await svc.auth.admin.getUserById(body.userId);
  if (getErr) return fail(getErr.message, 500);

  const { error } = await svc.auth.admin.updateUserById(body.userId, {
    user_metadata: { ...(existing.user?.user_metadata ?? {}), role: body.role },
  });
  if (error) return fail(error.message, 500);

  return ok({ ok: true, userId: body.userId, role: body.role });
}

// POST /api/admin/users — { email, password, role?, name? } create a user.
export async function POST(request: NextRequest) {
  const guard = requireBackend();
  if (guard) return guard;
  const gate = await requireAdmin();
  if (gate.res) return gate.res;

  let body: { email?: string; password?: string; role?: string; name?: string };
  try {
    body = await request.json();
  } catch {
    return fail("Invalid JSON body");
  }
  if (!body.email || !body.password) return fail("email and password required");
  const role = body.role && ROLES.includes(body.role) ? body.role : "analyst";

  const svc = createServiceClient();
  const { data, error } = await svc.auth.admin.createUser({
    email: body.email,
    password: body.password,
    email_confirm: true,
    user_metadata: { role, name: body.name?.trim() || body.email.split("@")[0] },
  });
  if (error) return fail(error.message, 500);

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
