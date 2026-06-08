import { type NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { createServiceClient, hasSupabaseEnv } from "@/lib/supabase/server";
import { toScimUser, parseUserNameFilter, scimList, scimError } from "@/lib/scim";
import { resolveScimOrg, userToScimInput, orgIdOf } from "@/lib/scim-server";

const SCIM_JSON = { "Content-Type": "application/scim+json" };

function err(status: number, detail: string) {
  return NextResponse.json(scimError(status, detail), { status, headers: SCIM_JSON });
}

// GET /api/scim/v2/Users — list org members (supports `userName eq` filter +
// startIndex/count paging).
export async function GET(request: NextRequest) {
  if (!hasSupabaseEnv()) return err(503, "Backend not configured");
  const svc = createServiceClient();
  const orgId = await resolveScimOrg(svc, request.headers.get("authorization"));
  if (!orgId) return err(401, "Invalid SCIM token");

  const sp = request.nextUrl.searchParams;
  const wanted = parseUserNameFilter(sp.get("filter"));
  const startIndex = Math.max(Number(sp.get("startIndex") ?? 1), 1);
  const count = Math.min(Math.max(Number(sp.get("count") ?? 100), 0), 200);

  const { data, error } = await svc.auth.admin.listUsers();
  if (error) return err(500, "Directory unavailable");

  let members = data.users.filter((u) => orgIdOf(u) === orgId);
  if (wanted) members = members.filter((u) => (u.email ?? "").toLowerCase() === wanted);

  const page = members.slice(startIndex - 1, startIndex - 1 + count);
  const resources = page.map((u) => toScimUser(userToScimInput(u)));
  return NextResponse.json(scimList(resources, members.length, startIndex), {
    headers: SCIM_JSON,
  });
}

// POST /api/scim/v2/Users — provision a user into the org.
export async function POST(request: NextRequest) {
  if (!hasSupabaseEnv()) return err(503, "Backend not configured");
  const svc = createServiceClient();
  const orgId = await resolveScimOrg(svc, request.headers.get("authorization"));
  if (!orgId) return err(401, "Invalid SCIM token");

  let body: {
    userName?: string;
    emails?: { value?: string; primary?: boolean }[];
    name?: { formatted?: string; givenName?: string };
    displayName?: string;
  };
  try {
    body = await request.json();
  } catch {
    return err(400, "Invalid JSON");
  }

  const email = (body.userName ?? body.emails?.[0]?.value ?? "").toLowerCase().trim();
  if (!email) return err(400, "userName (email) is required");
  const name =
    body.name?.formatted ??
    body.displayName ??
    body.name?.givenName ??
    email.split("@")[0];

  const { data, error } = await svc.auth.admin.createUser({
    email,
    password: randomBytes(24).toString("base64url"), // IdP-managed; user resets/SSOs in
    email_confirm: true,
    user_metadata: { role: "analyst", name },
    app_metadata: { org_id: orgId },
  });
  if (error || !data.user) return err(409, error?.message ?? "Could not create user");

  return NextResponse.json(toScimUser(userToScimInput(data.user)), {
    status: 201,
    headers: SCIM_JSON,
  });
}
