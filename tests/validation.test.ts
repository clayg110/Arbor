import { describe, it, expect, afterEach, vi } from "vitest";
import { z } from "zod";
import { parseJson, optionalContactEmail, optionalContactUrl } from "@/lib/validation";
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

describe("optionalContactEmail", () => {
  it("allows empty / null / absent", () => {
    expect(optionalContactEmail.safeParse(undefined).success).toBe(true);
    expect(optionalContactEmail.safeParse(null).success).toBe(true);
    expect(optionalContactEmail.safeParse("").success).toBe(true);
  });
  it("accepts a valid email, rejects garbage", () => {
    expect(optionalContactEmail.safeParse("a@b.com").success).toBe(true);
    expect(optionalContactEmail.safeParse("not-an-email").success).toBe(false);
  });
});

describe("optionalContactUrl", () => {
  it("allows empty / null / absent", () => {
    expect(optionalContactUrl.safeParse(undefined).success).toBe(true);
    expect(optionalContactUrl.safeParse(null).success).toBe(true);
    expect(optionalContactUrl.safeParse("").success).toBe(true);
  });
  it("accepts http(s) + schemeless, rejects javascript:", () => {
    expect(optionalContactUrl.safeParse("https://x.com").success).toBe(true);
    expect(optionalContactUrl.safeParse("linkedin.com/in/x").success).toBe(true);
    expect(optionalContactUrl.safeParse("javascript:alert(1)").success).toBe(false);
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
    const r = new Request("http://x", {
      headers: { "x-forwarded-for": "1.2.3.4, 5.6.7.8" },
    });
    expect(clientIp(r)).toBe("1.2.3.4");
  });
  it("falls back to unknown", () => {
    expect(clientIp(new Request("http://x"))).toBe("unknown");
  });
});
