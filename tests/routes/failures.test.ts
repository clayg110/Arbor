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
vi.mock("@/lib/ingest/pipeline", () => ({ processItem: vi.fn() }));

import { GET, POST, DELETE } from "@/app/api/admin/failures/route";
import { processItem } from "@/lib/ingest/pipeline";

const row = {
  id: "f1",
  source_type: "rss_feed",
  source_name: "PE Wire",
  doc_type: "RSS feed",
  source_url: "https://x/1",
  raw_text: "Acme explores a sale.",
  reason: "extract_failed",
  created_at: "2026-06-01T00:00:00Z",
};

function nreq(url: string, method: string, body?: unknown): NextRequest {
  return new NextRequest(url, {
    method,
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe("GET /api/admin/failures", () => {
  beforeEach(() =>
    installClient(
      makeClient({ user: fakeUser.admin, result: { data: [row], error: null } })
    )
  );

  it("403 for a non-admin", async () => {
    installClient(makeClient({ user: fakeUser.analyst }));
    expect((await GET(nreq("http://x/api/admin/failures", "GET"))).status).toBe(403);
  });

  it("lists dead-lettered signals", async () => {
    const res = await GET(nreq("http://x/api/admin/failures", "GET"));
    expect(res.status).toBe(200);
    const json = (await res.json()) as { failures: { id: string; reason: string }[] };
    expect(json.failures[0]).toMatchObject({ id: "f1", reason: "extract_failed" });
  });
});

describe("POST /api/admin/failures (replay)", () => {
  beforeEach(() => {
    installClient(
      makeClient({ user: fakeUser.admin, result: { data: row, error: null } })
    );
    vi.mocked(processItem).mockReset();
  });

  it("replays + reports success when processing succeeds", async () => {
    vi.mocked(processItem).mockImplementation(async (_s, _m, _d, counts) => {
      counts.created = 1;
    });
    const res = await POST(nreq("http://x/api/admin/failures", "POST", { id: "f1" }));
    expect(res.status).toBe(200);
    expect((await res.json()).ok).toBe(true);
  });

  it("reports failure (keeps the row) when processing fails again", async () => {
    vi.mocked(processItem).mockImplementation(async (_s, _m, _d, counts) => {
      counts.errors = 1;
    });
    const res = await POST(nreq("http://x/api/admin/failures", "POST", { id: "f1" }));
    expect(res.status).toBe(200);
    expect((await res.json()).ok).toBe(false);
  });

  it("404 when the failure id is unknown", async () => {
    installClient(
      makeClient({ user: fakeUser.admin, result: { data: null, error: null } })
    );
    const res = await POST(nreq("http://x/api/admin/failures", "POST", { id: "nope" }));
    expect(res.status).toBe(404);
  });
});

describe("DELETE /api/admin/failures (dismiss)", () => {
  beforeEach(() => installClient(makeClient({ user: fakeUser.admin })));

  it("dismisses a failure", async () => {
    const res = await DELETE(nreq("http://x/api/admin/failures?id=f1", "DELETE"));
    expect(res.status).toBe(200);
    expect((await res.json()).id).toBe("f1");
  });
});
