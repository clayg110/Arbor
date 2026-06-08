import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { makeClient, installClient, fakeUser } from "../helpers/sb";

vi.mock("@/lib/supabase/server", () => ({
  hasSupabaseEnv: () => true,
  createClient: async () => (globalThis as Record<string, unknown>).__sb,
  createServiceClient: () => (globalThis as Record<string, unknown>).__sb,
}));

import { GET } from "@/app/api/admin/audit/route";

function get(): NextRequest {
  return new NextRequest("http://x/api/admin/audit?limit=50");
}

const auditRow = {
  id: "a1",
  action: "note.create",
  entity_type: "note",
  entity_id: "n1",
  actor_email: "analyst@arbor.test",
  metadata: {},
  created_at: "2026-01-01T00:00:00Z",
  org_id: "org-1",
};

describe("GET /api/admin/audit (admin gate)", () => {
  beforeEach(() =>
    installClient(
      makeClient({ user: fakeUser.admin, result: { data: [auditRow], error: null } })
    )
  );

  it("401 when unauthenticated", async () => {
    installClient(makeClient({ user: null }));
    const res = await GET(get());
    expect(res.status).toBe(401);
  });

  it("403 for a non-admin (analyst)", async () => {
    installClient(makeClient({ user: fakeUser.analyst }));
    const res = await GET(get());
    expect(res.status).toBe(403);
  });

  it("returns mapped audit entries for an admin", async () => {
    const res = await GET(get());
    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      entries: { id: string; action: string; entityType: string }[];
    };
    expect(json.entries[0]).toMatchObject({
      id: "a1",
      action: "note.create",
      entityType: "note",
    });
  });
});
