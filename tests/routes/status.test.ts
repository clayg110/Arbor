import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

const h = vi.hoisted(() => ({
  hasBackend: false,
  pipelines: [] as { pipeline: string; ran_at: string; errors: number; ok: boolean }[],
  pipelineError: null as unknown,
  freshness: { stale: false, lastSignalAt: "x", ageHours: 1, maxAgeHours: 24 },
}));

vi.mock("@/lib/supabase/server", () => ({
  hasSupabaseEnv: () => h.hasBackend,
  createServiceClient: () => ({
    from: () => ({
      select: async () => ({ data: h.pipelines, error: h.pipelineError }),
    }),
  }),
}));

vi.mock("@/lib/freshness", () => ({
  checkFreshness: async () => h.freshness,
}));

import { GET } from "@/app/api/status/route";

beforeEach(() => {
  h.hasBackend = false;
  h.pipelines = [];
  h.pipelineError = null;
  h.freshness = { stale: false, lastSignalAt: "x", ageHours: 1, maxAgeHours: 24 };
});
afterEach(() => vi.unstubAllEnvs());

describe("GET /api/status", () => {
  it("reports mock mode with no backend (no DB read)", async () => {
    const res = await GET();
    const json = (await res.json()) as { status: string; mode: string; checks: object };
    expect(json.status).toBe("mock");
    expect(json.mode).toBe("mock");
    expect(json.checks).toBeTruthy();
    expect(res.headers.get("cache-control")).toBe("no-store");
  });

  it("operational when live, fresh, and pipelines healthy", async () => {
    h.hasBackend = true;
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "svc");
    h.pipelines = [{ pipeline: "carveouts", ran_at: "t", errors: 0, ok: true }];
    const res = await GET();
    const json = (await res.json()) as {
      status: string;
      db: string;
      pipelines: { pipeline: string }[];
    };
    expect(json.status).toBe("operational");
    expect(json.db).toBe("ok");
    expect(json.pipelines[0]!.pipeline).toBe("carveouts");
  });

  it("degraded when stale", async () => {
    h.hasBackend = true;
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "svc");
    h.freshness = { stale: true, lastSignalAt: "x", ageHours: 99, maxAgeHours: 24 };
    const res = await GET();
    expect(((await res.json()) as { status: string }).status).toBe("degraded");
  });

  it("degraded with a db read error", async () => {
    h.hasBackend = true;
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "svc");
    h.pipelineError = { message: "boom" };
    const res = await GET();
    const json = (await res.json()) as { status: string; db: string };
    expect(json.db).toBe("error");
    expect(json.status).toBe("degraded");
  });
});
