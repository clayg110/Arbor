import { describe, it, expect, beforeEach, vi } from "vitest";
import type { NextRequest } from "next/server";
import { makeClient, installClient, fakeUser } from "../helpers/sb";

vi.mock("@/lib/supabase/server", () => ({
  hasSupabaseEnv: () => true,
  createClient: async () => (globalThis as Record<string, unknown>).__sb,
  createServiceClient: () => (globalThis as Record<string, unknown>).__sb,
}));

import { GET } from "@/app/api/notifications/route";
import { POST } from "@/app/api/notifications/read/route";

const rows = [
  {
    id: "n1",
    type: "watchlist",
    title: "Acme",
    body: "Moved to In market",
    entity_type: "company",
    entity_id: "c1",
    read_at: null,
    created_at: "2026-06-08T00:00:00Z",
  },
  {
    id: "n2",
    type: "watchlist",
    title: "Globex",
    body: "Pulled",
    entity_type: "company",
    entity_id: "c2",
    read_at: "2026-06-07T00:00:00Z",
    created_at: "2026-06-07T00:00:00Z",
  },
];

function post(body: unknown): NextRequest {
  return new Request("http://x/api/notifications/read", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }) as unknown as NextRequest;
}

describe("GET /api/notifications", () => {
  beforeEach(() =>
    installClient(
      makeClient({ user: fakeUser.analyst, result: { data: rows, error: null } })
    )
  );

  it("401 when unauthenticated", async () => {
    installClient(makeClient({ user: null }));
    expect((await GET()).status).toBe(401);
  });

  it("returns notifications + unread count", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      notifications: { id: string; entityType: string }[];
      unread: number;
    };
    expect(json.notifications[0]).toMatchObject({ id: "n1", entityType: "company" });
    expect(json.unread).toBe(1);
  });
});

describe("POST /api/notifications/read", () => {
  beforeEach(() =>
    installClient(
      makeClient({ user: fakeUser.analyst, result: { data: [], error: null } })
    )
  );

  it("401 when unauthenticated", async () => {
    installClient(makeClient({ user: null }));
    expect((await POST(post({}))).status).toBe(401);
  });

  it("marks all read", async () => {
    const res = await POST(post({}));
    expect(res.status).toBe(200);
    expect((await res.json()).ok).toBe(true);
  });

  it("marks one read by id", async () => {
    const res = await POST(post({ id: "n1" }));
    expect(res.status).toBe(200);
  });
});
