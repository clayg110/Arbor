import { describe, it, expect, afterEach, vi } from "vitest";
import { z } from "zod";
import { parseJson } from "@/lib/validation";
import { rateLimit, clientIp } from "@/lib/redis/ratelimit";

const schema = z.object({ name: z.string().min(1), n: z.number().int().optional() });

function req(body: unknown) {
  return new Request("http://x/api", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("parseJson", () => {
  it("returns typed data on a valid body", async () => {
    const r = await parseJson(req({ name: "ok", n: 3 }), schema);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data).toEqual({ name: "ok", n: 3 });
  });

  it("rejects an invalid body with a 400 + field message", async () => {
    const r = await parseJson(req({ name: "" }), schema);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.res.status).toBe(400);
  });

  it("rejects non-JSON", async () => {
    const bad = new Request("http://x/api", { method: "POST", body: "{not json" });
    const r = await parseJson(bad, schema);
    expect(r.ok).toBe(false);
  });
});

describe("rateLimit", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("fails open (always ok) without Redis env", async () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
    const r = await rateLimit("ip-1", { limit: 5, window: "1 m", prefix: "test" });
    expect(r.ok).toBe(true);
  });
});

describe("clientIp", () => {
  it("takes the first x-forwarded-for hop", () => {
    const r = new Request("http://x", { headers: { "x-forwarded-for": "1.2.3.4, 5.6.7.8" } });
    expect(clientIp(r)).toBe("1.2.3.4");
  });
  it("falls back to unknown", () => {
    expect(clientIp(new Request("http://x"))).toBe("unknown");
  });
});
