import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { makeClient, installClient } from "../helpers/sb";

vi.mock("@/lib/supabase/server", () => ({
  hasSupabaseEnv: () => true,
  createClient: async () => (globalThis as Record<string, unknown>).__sb,
  createServiceClient: () => (globalThis as Record<string, unknown>).__sb,
}));

import { GET } from "@/app/api/feed/route";

describe("GET /api/feed", () => {
  beforeEach(() => installClient(makeClient({ result: { data: [], error: null } })));

  it("returns an empty feed with a null cursor when there are no rows", async () => {
    const res = await GET(new NextRequest("http://x/api/feed"));
    expect(res.status).toBe(200);
    const json = (await res.json()) as { items: unknown[]; nextCursor: string | null };
    expect(json.items).toEqual([]);
    expect(json.nextCursor).toBeNull();
  });
});
