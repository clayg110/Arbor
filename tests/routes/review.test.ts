import { describe, it, expect, beforeEach, vi } from "vitest";
import type { NextRequest } from "next/server";
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

import { POST } from "@/app/api/review/[id]/route";

function post(body: unknown): NextRequest {
  return new Request("http://x/api/review/c1", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }) as unknown as NextRequest;
}

const params = { params: Promise.resolve({ id: "c1" }) };

describe("POST /api/review/[id]", () => {
  beforeEach(() =>
    installClient(
      makeClient({
        user: fakeUser.analyst,
        result: { data: [], error: null },
        rpc: { data: [{ id: "h1" }], error: null },
      })
    )
  );

  it("401 when unauthenticated", async () => {
    installClient(makeClient({ user: null }));
    const res = await POST(post({ action: "confirm" }), params);
    expect(res.status).toBe(401);
  });

  it("400 on an unknown action (zod enum)", async () => {
    const res = await POST(post({ action: "explode" }), params);
    expect(res.status).toBe(400);
  });

  it("400 on override without a stage", async () => {
    const res = await POST(post({ action: "override" }), params);
    expect(res.status).toBe(400);
  });

  it("confirms → 200", async () => {
    const res = await POST(post({ action: "confirm" }), params);
    expect(res.status).toBe(200);
    expect((await res.json()).ok).toBe(true);
  });

  it("overrides with a stage → 200 + history", async () => {
    const res = await POST(post({ action: "override", stage: "pulled" }), params);
    expect(res.status).toBe(200);
    const json = (await res.json()) as { ok: boolean; history: { id: string }[] };
    expect(json.ok).toBe(true);
    expect(json.history[0].id).toBe("h1");
  });
});
