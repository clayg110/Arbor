import { describe, it, expect, afterEach, vi } from "vitest";
import {
  interpretSiteverify,
  verifyTurnstile,
  hasTurnstileSecret,
  turnstileSiteKey,
} from "@/lib/turnstile";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("interpretSiteverify", () => {
  it("treats success:true as ok", () => {
    expect(interpretSiteverify({ success: true })).toEqual({ ok: true, errors: [] });
  });

  it("treats anything else as failure and surfaces string error-codes", () => {
    expect(
      interpretSiteverify({ success: false, "error-codes": ["invalid-input-response"] })
    ).toEqual({ ok: false, errors: ["invalid-input-response"] });
  });

  it("is defensive about non-array / non-string error-codes and junk input", () => {
    expect(interpretSiteverify({ success: true, "error-codes": [1, "x", null] })).toEqual(
      {
        ok: true,
        errors: ["x"],
      }
    );
    expect(interpretSiteverify(null)).toEqual({ ok: false, errors: [] });
    expect(interpretSiteverify("nope")).toEqual({ ok: false, errors: [] });
  });
});

describe("env helpers", () => {
  it("reports the public site key and secret presence", () => {
    vi.stubEnv("NEXT_PUBLIC_TURNSTILE_SITE_KEY", "");
    vi.stubEnv("TURNSTILE_SECRET_KEY", "");
    expect(turnstileSiteKey()).toBeNull();
    expect(hasTurnstileSecret()).toBe(false);
    vi.stubEnv("NEXT_PUBLIC_TURNSTILE_SITE_KEY", "site");
    vi.stubEnv("TURNSTILE_SECRET_KEY", "sek");
    expect(turnstileSiteKey()).toBe("site");
    expect(hasTurnstileSecret()).toBe(true);
  });
});

describe("verifyTurnstile", () => {
  it("is dormant (passes) with no secret — never calls out", async () => {
    vi.stubEnv("TURNSTILE_SECRET_KEY", "");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect(await verifyTurnstile(null)).toEqual({ ok: true, dormant: true });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("fails closed when enforcing and no token is supplied", async () => {
    vi.stubEnv("TURNSTILE_SECRET_KEY", "sek");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect(await verifyTurnstile(null)).toEqual({
      ok: false,
      errors: ["missing-input-response"],
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("posts secret + token (+ ip) to siteverify and returns the verdict", async () => {
    vi.stubEnv("TURNSTILE_SECRET_KEY", "sek");
    const fetchMock = vi.fn(
      async () =>
        ({
          ok: true,
          json: async () => ({ success: true }),
        }) as unknown as Response
    );
    vi.stubGlobal("fetch", fetchMock);

    const r = await verifyTurnstile("tok", "1.2.3.4");
    expect(r.ok).toBe(true);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain("challenges.cloudflare.com/turnstile/v0/siteverify");
    const body = String((init.body as URLSearchParams).toString());
    expect(body).toContain("secret=sek");
    expect(body).toContain("response=tok");
    expect(body).toContain("remoteip=1.2.3.4");
  });

  it("reports an http error verdict on a non-2xx from siteverify", async () => {
    vi.stubEnv("TURNSTILE_SECRET_KEY", "sek");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, status: 503 }) as unknown as Response)
    );
    expect(await verifyTurnstile("tok")).toEqual({ ok: false, errors: ["http-503"] });
  });

  it("fails closed if the network throws", async () => {
    vi.stubEnv("TURNSTILE_SECRET_KEY", "sek");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network");
      })
    );
    expect(await verifyTurnstile("tok")).toEqual({ ok: false, errors: ["fetch-failed"] });
  });
});
