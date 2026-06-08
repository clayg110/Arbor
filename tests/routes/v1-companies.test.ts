import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { makeClient, installClient } from "../helpers/sb";

vi.mock("@/lib/supabase/server", () => ({
  hasSupabaseEnv: () => true,
  createClient: async () => (globalThis as Record<string, unknown>).__sb,
  createServiceClient: () => (globalThis as Record<string, unknown>).__sb,
}));
vi.mock("@/lib/audit", () => ({
  auditAs: vi.fn(async () => {}),
  logAudit: vi.fn(async () => {}),
}));
// Keep bearerFrom real; stub only the (DB-backed) key verification.
vi.mock("@/lib/api-keys", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-keys")>();
  return { ...actual, verifyApiKey: vi.fn() };
});

import { GET, OPTIONS } from "@/app/api/v1/companies/route";
import { verifyApiKey } from "@/lib/api-keys";

function get(headers: Record<string, string> = {}): NextRequest {
  return new NextRequest("http://x/api/v1/companies?limit=10", { headers });
}

const sampleRow = {
  id: "c1",
  name: "Acme",
  sector: "chemicals",
  deal_type: "carveout",
  current_stage: "in_market",
  confidence: "high",
  sponsor_firm: null,
  parent_company: null,
  revenue: null,
  ebitda: null,
  updated_at: "2026-01-01T00:00:00Z",
};

describe("GET /api/v1/companies", () => {
  beforeEach(() => {
    installClient(makeClient({ result: { data: [sampleRow], count: 1, error: null } }));
    vi.mocked(verifyApiKey).mockReset();
  });

  it("401 when no Authorization header", async () => {
    const res = await GET(get());
    expect(res.status).toBe(401);
    expect((await res.json()).error).toMatch(/Missing API key/);
  });

  it("401 on an invalid/revoked key", async () => {
    vi.mocked(verifyApiKey).mockResolvedValue(null);
    const res = await GET(get({ authorization: "Bearer arbor_deadbeef_xyz" }));
    expect(res.status).toBe(401);
  });

  it("403 when the key lacks the read scope", async () => {
    vi.mocked(verifyApiKey).mockResolvedValue({
      keyId: "k1",
      orgId: "org-1",
      scopes: ["write"],
    });
    const res = await GET(get({ authorization: "Bearer arbor_x_y" }));
    expect(res.status).toBe(403);
  });

  it("returns companies + total for a valid key", async () => {
    vi.mocked(verifyApiKey).mockResolvedValue({
      keyId: "k1",
      orgId: "org-1",
      scopes: ["read"],
    });
    const res = await GET(get({ authorization: "Bearer arbor_deadbeef_xyz" }));
    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      companies: { id: string }[];
      total: number;
      nextCursor: string | null;
    };
    expect(json.total).toBe(1);
    expect(json.companies[0].id).toBe("c1");
    // one row, default limit → not a full page → no next cursor
    expect(json.nextCursor).toBeNull();
  });

  it("emits a nextCursor when the page is full", async () => {
    vi.mocked(verifyApiKey).mockResolvedValue({
      keyId: "k1",
      orgId: "org-1",
      scopes: [],
    });
    const res = await GET(
      new NextRequest("http://x/api/v1/companies?limit=1", {
        headers: { authorization: "Bearer arbor_x_y" },
      })
    );
    expect(res.status).toBe(200);
    const json = (await res.json()) as { nextCursor: string | null };
    expect(typeof json.nextCursor).toBe("string");
  });

  it("sets permissive CORS + no-store on the response", async () => {
    vi.mocked(verifyApiKey).mockResolvedValue({
      keyId: "k1",
      orgId: "org-1",
      scopes: [],
    });
    const res = await GET(get({ authorization: "Bearer arbor_x_y" }));
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
    expect(res.headers.get("cache-control")).toBe("no-store");
  });

  it("OPTIONS preflight returns 204 + CORS", () => {
    const res = OPTIONS();
    expect(res.status).toBe(204);
    expect(res.headers.get("access-control-allow-methods")).toMatch(/GET/);
  });
});
