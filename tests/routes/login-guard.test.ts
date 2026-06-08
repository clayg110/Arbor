import { describe, it, expect, beforeEach, vi } from "vitest";

const m = vi.hoisted(() => ({
  checkLockout: vi.fn(async () => ({ locked: false, retryAfter: 0 })),
  recordFailure: vi.fn(async () => ({ locked: false, retryAfter: 0 })),
  clearFailures: vi.fn(async () => {}),
}));

vi.mock("@/lib/lockout", () => m);

import { POST } from "@/app/api/security/login-guard/route";

function req(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request("http://x/api/security/login-guard", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  m.checkLockout.mockClear().mockResolvedValue({ locked: false, retryAfter: 0 });
  m.recordFailure.mockClear().mockResolvedValue({ locked: false, retryAfter: 0 });
  m.clearFailures.mockClear().mockResolvedValue(undefined);
});

describe("POST /api/security/login-guard", () => {
  it("check → 200 unlocked, deriving IP from x-forwarded-for", async () => {
    const res = await POST(
      req(
        { action: "check", email: "A@x.com" },
        { "x-forwarded-for": "5.6.7.8, 1.1.1.1" }
      )
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ locked: false, retryAfter: 0 });
    expect(m.checkLockout).toHaveBeenCalledWith("A@x.com", "5.6.7.8");
  });

  it("check → 429 when locked", async () => {
    m.checkLockout.mockResolvedValue({ locked: true, retryAfter: 900 });
    const res = await POST(req({ action: "check", email: "a@x.com" }));
    expect(res.status).toBe(429);
    expect(await res.json()).toEqual({ locked: true, retryAfter: 900 });
  });

  it("fail → records a failure and echoes the resulting state", async () => {
    m.recordFailure.mockResolvedValue({ locked: true, retryAfter: 120 });
    const res = await POST(req({ action: "fail", email: "a@x.com" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ locked: true, retryAfter: 120 });
    expect(m.recordFailure).toHaveBeenCalledOnce();
  });

  it("reset → clears and returns ok", async () => {
    const res = await POST(req({ action: "reset", email: "a@x.com" }));
    expect(await res.json()).toEqual({ ok: true });
    expect(m.clearFailures).toHaveBeenCalledOnce();
  });

  it("defaults to a check on a malformed body (never trusts client IP)", async () => {
    const bad = new Request("http://x/api/security/login-guard", {
      method: "POST",
      body: "not-json",
    });
    const res = await POST(bad);
    expect(res.status).toBe(200);
    expect(m.checkLockout).toHaveBeenCalledOnce();
  });
});
