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
vi.mock("@/lib/adapters", () => ({
  toNotes: (rows: { id: string; content: string }[]) =>
    rows.map((r) => ({ id: r.id, content: r.content })),
}));

import { POST } from "@/app/api/notes/route";

function post(body: unknown): NextRequest {
  return new Request("http://x/api/notes", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }) as unknown as NextRequest;
}

describe("POST /api/notes", () => {
  beforeEach(() =>
    installClient(
      makeClient({
        user: fakeUser.analyst,
        result: { data: { id: "n1", content: "hi" }, error: null },
      })
    )
  );

  it("401 when unauthenticated", async () => {
    installClient(makeClient({ user: null }));
    const res = await POST(post({ companyId: "c1", content: "hi" }));
    expect(res.status).toBe(401);
  });

  it("400 on an invalid body (empty content)", async () => {
    const res = await POST(post({ companyId: "c1", content: "" }));
    expect(res.status).toBe(400);
  });

  it("400 on a missing field", async () => {
    const res = await POST(post({ content: "hi" }));
    expect(res.status).toBe(400);
  });

  it("persists + returns the note on a valid body", async () => {
    const res = await POST(post({ companyId: "c1", content: "hi" }));
    expect(res.status).toBe(200);
    const json = (await res.json()) as { note: { id: string; content: string } };
    expect(json.note).toEqual({ id: "n1", content: "hi" });
  });

  it("500 (generic) when the insert errors, leaking no DB detail", async () => {
    installClient(
      makeClient({
        user: fakeUser.analyst,
        result: { data: null, error: { message: "duplicate key value" } },
      })
    );
    const res = await POST(post({ companyId: "c1", content: "hi" }));
    expect(res.status).toBe(500);
    const json = (await res.json()) as { error: string };
    expect(json.error).toBe("Internal server error");
    expect(json.error).not.toContain("duplicate");
  });
});
