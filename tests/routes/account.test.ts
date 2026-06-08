import { describe, it, expect, beforeEach, vi } from "vitest";
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

import { GET as exportGET } from "@/app/api/account/export/route";
import { POST as deletePOST } from "@/app/api/account/delete/route";

describe("GET /api/account/export", () => {
  beforeEach(() =>
    installClient(
      makeClient({ user: fakeUser.analyst, result: { data: [], error: null } })
    )
  );

  it("401 when unauthenticated", async () => {
    installClient(makeClient({ user: null }));
    const res = await exportGET();
    expect(res.status).toBe(401);
  });

  it("returns the caller's data as a JSON attachment", async () => {
    const res = await exportGET();
    expect(res.status).toBe(200);
    expect(res.headers.get("content-disposition")).toContain("attachment");
    const json = (await res.json()) as { profile: { email: string }; notes: unknown[] };
    expect(json.profile.email).toBe(fakeUser.analyst.email);
    expect(Array.isArray(json.notes)).toBe(true);
  });
});

describe("POST /api/account/delete", () => {
  it("401 when unauthenticated", async () => {
    installClient(makeClient({ user: null }));
    const res = await deletePOST();
    expect(res.status).toBe(401);
  });

  it("purges owned rows + deletes the account", async () => {
    const deleteUser = vi.fn(async () => ({ error: null }));
    installClient(
      makeClient({
        user: fakeUser.analyst,
        result: { data: [], error: null },
        admin: { deleteUser },
      })
    );
    const res = await deletePOST();
    expect(res.status).toBe(200);
    expect((await res.json()).ok).toBe(true);
    expect(deleteUser).toHaveBeenCalledWith(fakeUser.analyst.id);
  });
});
