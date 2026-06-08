import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { makeClient, installClient, fakeUser } from "../helpers/sb";

vi.mock("@/lib/supabase/server", () => ({
  hasSupabaseEnv: () => true,
  createClient: async () => (globalThis as Record<string, unknown>).__sb,
  createServiceClient: () => (globalThis as Record<string, unknown>).__sb,
}));
vi.mock("@/lib/audit", () => ({
  auditAs: vi.fn(async () => {}),
  logAudit: vi.fn(async () => {}),
}));
vi.mock("@/lib/email", () => ({
  hasEmailEnv: () => true,
  sendEmail: vi.fn(async () => ({ ok: true, id: "msg_1" })),
  inviteEmail: () => ({ subject: "s", html: "h" }),
}));

import { POST as invitePOST } from "@/app/api/admin/invite/route";
import { GET as orgGET, PATCH as orgPATCH } from "@/app/api/admin/org/route";
import { DELETE as usersDELETE } from "@/app/api/admin/users/route";
import { POST as orgsPOST } from "@/app/api/orgs/route";

function nreq(url: string, method: string, body?: unknown): NextRequest {
  return new NextRequest(url, {
    method,
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
}

// ---- invite ----------------------------------------------------------------
describe("POST /api/admin/invite", () => {
  beforeEach(() =>
    installClient(
      makeClient({
        user: fakeUser.admin,
        result: { data: { name: "Acme PE" } },
        admin: {
          generateLink: vi.fn(async () => ({
            data: {
              user: { id: "new1", user_metadata: {} },
              properties: { action_link: "https://app/accept?t=1" },
            },
            error: null,
          })),
          updateUserById: vi.fn(async () => ({ error: null })),
        },
      })
    )
  );

  it("403 for a non-admin", async () => {
    installClient(makeClient({ user: fakeUser.analyst }));
    const res = await invitePOST(
      nreq("http://x/api/admin/invite", "POST", { email: "a@b.com" })
    );
    expect(res.status).toBe(403);
  });

  it("400 on a bad email", async () => {
    const res = await invitePOST(
      nreq("http://x/api/admin/invite", "POST", { email: "not-an-email" })
    );
    expect(res.status).toBe(400);
  });

  it("provisions + emails the invite", async () => {
    const res = await invitePOST(
      nreq("http://x/api/admin/invite", "POST", { email: "a@b.com", role: "analyst" })
    );
    expect(res.status).toBe(200);
    const json = (await res.json()) as { ok: boolean; emailed: boolean; userId: string };
    expect(json).toMatchObject({ ok: true, emailed: true, userId: "new1" });
  });

  it("403 when the seat limit is reached", async () => {
    const members = [
      { app_metadata: { org_id: "org-1" } },
      { app_metadata: { org_id: "org-1" } },
      { app_metadata: { org_id: "org-1" } },
    ];
    installClient(
      makeClient({
        user: fakeUser.admin,
        result: { data: { plan: "free", seats: null } },
        admin: { listUsers: async () => ({ data: { users: members }, error: null }) },
      })
    );
    const res = await invitePOST(
      nreq("http://x/api/admin/invite", "POST", { email: "a@b.com" })
    );
    expect(res.status).toBe(403);
  });

  it("409 when generateLink fails (e.g. user exists)", async () => {
    installClient(
      makeClient({
        user: fakeUser.admin,
        admin: {
          generateLink: vi.fn(async () => ({ data: null, error: { message: "exists" } })),
        },
      })
    );
    const res = await invitePOST(
      nreq("http://x/api/admin/invite", "POST", { email: "a@b.com" })
    );
    expect(res.status).toBe(409);
  });
});

// ---- org settings ----------------------------------------------------------
describe("GET/PATCH /api/admin/org", () => {
  beforeEach(() =>
    installClient(
      makeClient({
        user: fakeUser.admin,
        result: { data: { id: "org-1", name: "Acme PE", created_at: "2026-01-01" } },
        admin: {
          listUsers: vi.fn(async () => ({
            data: {
              users: [
                { app_metadata: { org_id: "org-1" } },
                { app_metadata: { org_id: "org-1" } },
                { app_metadata: { org_id: "other" } },
              ],
            },
            error: null,
          })),
        },
      })
    )
  );

  it("returns org + member count scoped to the admin's org", async () => {
    const res = await orgGET();
    expect(res.status).toBe(200);
    const json = (await res.json()) as { org: { name: string; memberCount: number } };
    expect(json.org.name).toBe("Acme PE");
    expect(json.org.memberCount).toBe(2);
  });

  it("renames the org", async () => {
    const res = await orgPATCH(
      nreq("http://x/api/admin/org", "PATCH", { name: "Acme Capital" })
    );
    expect(res.status).toBe(200);
    expect((await res.json()).name).toBe("Acme Capital");
  });

  it("rejects an empty rename", async () => {
    const res = await orgPATCH(nreq("http://x/api/admin/org", "PATCH", { name: "" }));
    expect(res.status).toBe(400);
  });
});

// ---- member removal --------------------------------------------------------
describe("DELETE /api/admin/users", () => {
  beforeEach(() =>
    installClient(
      makeClient({
        user: fakeUser.admin,
        admin: {
          getUserById: vi.fn(async () => ({
            data: { user: { email: "x@y.com", app_metadata: { org_id: "org-1" } } },
            error: null,
          })),
          deleteUser: vi.fn(async () => ({ error: null })),
        },
      })
    )
  );

  it("blocks removing yourself", async () => {
    const res = await usersDELETE(
      nreq(`http://x/api/admin/users?userId=${fakeUser.admin.id}`, "DELETE")
    );
    expect(res.status).toBe(400);
  });

  it("removes a same-org member", async () => {
    const res = await usersDELETE(nreq("http://x/api/admin/users?userId=u2", "DELETE"));
    expect(res.status).toBe(200);
    expect((await res.json()).userId).toBe("u2");
  });

  it("403 across tenants", async () => {
    installClient(
      makeClient({
        user: fakeUser.admin,
        admin: {
          getUserById: vi.fn(async () => ({
            data: { user: { app_metadata: { org_id: "other-org" } } },
            error: null,
          })),
          deleteUser: vi.fn(async () => ({ error: null })),
        },
      })
    );
    const res = await usersDELETE(nreq("http://x/api/admin/users?userId=u2", "DELETE"));
    expect(res.status).toBe(403);
  });
});

// ---- self-serve org --------------------------------------------------------
describe("POST /api/orgs (self-serve)", () => {
  const noOrgUser = { id: "u9", email: "new@x.com", user_metadata: {}, app_metadata: {} };

  it("401 when unauthenticated", async () => {
    installClient(makeClient({ user: null }));
    const res = await orgsPOST(nreq("http://x/api/orgs", "POST", { name: "New Co" }));
    expect(res.status).toBe(401);
  });

  it("409 when already in an org", async () => {
    installClient(makeClient({ user: fakeUser.admin }));
    const res = await orgsPOST(nreq("http://x/api/orgs", "POST", { name: "New Co" }));
    expect(res.status).toBe(409);
  });

  it("creates the org + makes the caller admin", async () => {
    installClient(
      makeClient({
        user: noOrgUser,
        result: { data: { id: "org-9", name: "New Co" }, error: null },
        admin: {
          getUserById: vi.fn(async () => ({
            data: { user: { user_metadata: {} } },
            error: null,
          })),
          updateUserById: vi.fn(async () => ({ error: null })),
        },
      })
    );
    const res = await orgsPOST(nreq("http://x/api/orgs", "POST", { name: "New Co" }));
    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      ok: boolean;
      org: { id: string };
      refreshRequired: boolean;
    };
    expect(json).toMatchObject({ ok: true, refreshRequired: true });
    expect(json.org.id).toBe("org-9");
  });
});
