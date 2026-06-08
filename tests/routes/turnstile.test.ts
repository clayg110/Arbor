import { describe, it, expect, afterEach, vi } from "vitest";
import { POST } from "@/app/api/security/turnstile/route";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

function req(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request("http://x/api/security/turnstile", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

describe("POST /api/security/turnstile", () => {
  it("200 ok in dormant mode (no secret)", async () => {
    vi.stubEnv("TURNSTILE_SECRET_KEY", "");
    const res = await POST(req({ token: null }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it("403 when enforcing and the token is missing", async () => {
    vi.stubEnv("TURNSTILE_SECRET_KEY", "sek");
    vi.stubGlobal("fetch", vi.fn());
    const res = await POST(req({}));
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ ok: false });
  });

  it("forwards the client ip to siteverify and 200s on success", async () => {
    vi.stubEnv("TURNSTILE_SECRET_KEY", "sek");
    const fetchMock = vi.fn(
      async () =>
        ({
          ok: true,
          json: async () => ({ success: true }),
        }) as unknown as Response
    );
    vi.stubGlobal("fetch", fetchMock);

    const res = await POST(req({ token: "tok" }, { "cf-connecting-ip": "9.9.9.9" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(String((init.body as URLSearchParams).toString())).toContain(
      "remoteip=9.9.9.9"
    );
  });

  it("tolerates a malformed body (fails closed when enforcing)", async () => {
    vi.stubEnv("TURNSTILE_SECRET_KEY", "sek");
    vi.stubGlobal("fetch", vi.fn());
    const bad = new Request("http://x/api/security/turnstile", {
      method: "POST",
      body: "not-json",
    });
    const res = await POST(bad);
    expect(res.status).toBe(403);
  });
});
