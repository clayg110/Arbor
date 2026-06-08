import { type NextRequest, NextResponse } from "next/server";
import { createServiceClient, hasSupabaseEnv } from "@/lib/supabase/server";
import { toScimUser, scimError, patchActive } from "@/lib/scim";
import { resolveScimOrg, userToScimInput, orgIdOf } from "@/lib/scim-server";

const SCIM_JSON = { "Content-Type": "application/scim+json" };
function err(status: number, detail: string) {
  return NextResponse.json(scimError(status, detail), { status, headers: SCIM_JSON });
}

type Ctx = { params: Promise<{ id: string }> };

// Resolve the org + the target user, enforcing that the user belongs to the
// SCIM token's org (else 404 per SCIM).
async function authed(request: NextRequest, id: string) {
  if (!hasSupabaseEnv()) return { err: err(503, "Backend not configured") } as const;
  const svc = createServiceClient();
  const orgId = await resolveScimOrg(svc, request.headers.get("authorization"));
  if (!orgId) return { err: err(401, "Invalid SCIM token") } as const;
  const { data } = await svc.auth.admin.getUserById(id);
  if (!data?.user || orgIdOf(data.user) !== orgId) {
    return { err: err(404, "User not found") } as const;
  }
  return { svc, user: data.user } as const;
}

export async function GET(request: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const a = await authed(request, id);
  if ("err" in a) return a.err;
  return NextResponse.json(toScimUser(userToScimInput(a.user)), { headers: SCIM_JSON });
}

// PATCH — IdPs deprovision/reprovision via { active: false/true }. We map that to
// a Supabase ban (reversible), preserving the account + its data.
export async function PATCH(request: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const a = await authed(request, id);
  if ("err" in a) return a.err;

  let body: Parameters<typeof patchActive>[0];
  try {
    body = await request.json();
  } catch {
    return err(400, "Invalid JSON");
  }

  const active = patchActive(body);
  if (active !== null) {
    const { error } = await a.svc.auth.admin.updateUserById(id, {
      ban_duration: active ? "none" : "876000h",
    });
    if (error) return err(500, "Update failed");
  }
  const { data } = await a.svc.auth.admin.getUserById(id);
  return NextResponse.json(toScimUser(userToScimInput(data!.user!)), {
    headers: SCIM_JSON,
  });
}

export async function DELETE(request: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const a = await authed(request, id);
  if ("err" in a) return a.err;
  const { error } = await a.svc.auth.admin.deleteUser(id);
  if (error) return err(500, "Delete failed");
  return new NextResponse(null, { status: 204 });
}
