import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { makeClient, installClient, fakeUser } from "../helpers/sb";

vi.mock("@/lib/supabase/server", () => ({
  hasSupabaseEnv: () => true,
  createClient: async () => (globalThis as Record<string, unknown>).__sb,
  createServiceClient: () => (globalThis as Record<string, unknown>).__sb,
}));

import { GET } from "@/app/api/admin/audit/export/route";

function get(qs = ""): NextRequest {
  return new NextRequest(`http://x/api/admin/audit/export${qs}`);
}

const auditRow = {
  id: "a1",
  action: "company.stage_override",
  entity_type: "company",
  entity_id: "c1",
  actor_email: "admin@arbor.test",
  user_id: "u1",
  metadata: { from: "monitor_for_exit", to: "in_market" },
  created_at: "2026-01-01T00:00:00Z",
  org_id: "org-1",
};

describe("GET /api/admin/audit/export (CSV)", () => {
  beforeEach(() =>
    installClient(
      makeClient({ user: fakeUser.admin, result: { data: [auditRow], error: null } })
    )
  );

  it("401 when unauthenticated", async () => {
    installClient(makeClient({ user: null }));
    expect((await GET(get())).status).toBe(401);
  });

  it("403 for a non-admin", async () => {
    installClient(makeClient({ user: fakeUser.analyst }));
    expect((await GET(get())).status).toBe(403);
  });

  it("streams a CSV attachment with a BOM + header + escaped rows for an admin", async () => {
    const res = await GET(get());
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/csv");
    expect(res.headers.get("content-disposition")).toContain("attachment");
    expect(res.headers.get("content-disposition")).toContain("arbor-audit-");

    // BOM lives in the wire bytes (EF BB BF); text()/TextDecoder strip a leading
    // BOM on read, so assert it on the raw buffer.
    const bytes = new Uint8Array(await res.arrayBuffer());
    expect([bytes[0], bytes[1], bytes[2]]).toEqual([0xef, 0xbb, 0xbf]);
    const body = new TextDecoder().decode(bytes);
    const lines = body.split("\r\n");
    expect(lines[0]).toBe(
      "id,created_at,action,entity_type,entity_id,actor_email,user_id,org_id,metadata"
    );
    expect(lines[1]).toContain("a1");
    expect(lines[1]).toContain("company.stage_override");
    // jsonb metadata serialized + quoted
    expect(lines[1]).toContain('"{""from"":""monitor_for_exit"",""to"":""in_market""}"');
  });
});
