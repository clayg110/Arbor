import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// In-memory fake of the Upstash client, toggled on/off via `h.on`.
const h = vi.hoisted(() => ({
  on: false,
  store: new Map<string, number>(),
  ttls: new Map<string, number>(),
}));

vi.mock("@/lib/redis/client", () => ({
  hasRedisEnv: () => h.on,
  redis: () => ({
    async incr(k: string) {
      const n = (h.store.get(k) ?? 0) + 1;
      h.store.set(k, n);
      return n;
    },
    async expire(k: string, s: number) {
      h.ttls.set(k, s);
      return 1;
    },
    async ttl(k: string) {
      return h.ttls.get(k) ?? -1;
    },
    async get(k: string) {
      return h.store.get(k) ?? null;
    },
    async del(...ks: string[]) {
      ks.forEach((k) => {
        h.store.delete(k);
        h.ttls.delete(k);
      });
      return ks.length;
    },
  }),
}));

import {
  isLockedOut,
  retryAfterLabel,
  maxAttempts,
  lockoutWindowSec,
  checkLockout,
  recordFailure,
  clearFailures,
} from "@/lib/lockout";

beforeEach(() => {
  h.on = false;
  h.store.clear();
  h.ttls.clear();
});
afterEach(() => vi.unstubAllEnvs());

describe("pure helpers", () => {
  it("isLockedOut at/above threshold", () => {
    expect(isLockedOut(4, 5)).toBe(false);
    expect(isLockedOut(5, 5)).toBe(true);
    expect(isLockedOut(6, 5)).toBe(true);
  });

  it("retryAfterLabel formats seconds / minutes", () => {
    expect(retryAfterLabel(0)).toBe("a moment");
    expect(retryAfterLabel(30)).toBe("30 seconds");
    expect(retryAfterLabel(60)).toBe("1 minute");
    expect(retryAfterLabel(61)).toBe("2 minutes");
  });

  it("reads config with sane fallbacks", () => {
    vi.stubEnv("LOGIN_MAX_ATTEMPTS", "3");
    vi.stubEnv("LOGIN_LOCKOUT_MINUTES", "10");
    expect(maxAttempts()).toBe(3);
    expect(lockoutWindowSec()).toBe(600);
    vi.stubEnv("LOGIN_MAX_ATTEMPTS", "0"); // invalid → default 5
    vi.stubEnv("LOGIN_LOCKOUT_MINUTES", "x");
    expect(maxAttempts()).toBe(5);
    expect(lockoutWindowSec()).toBe(900);
  });
});

describe("dormant (no Redis)", () => {
  it("never locks and clear is a no-op", async () => {
    expect(await checkLockout("a@x.com", "1.1.1.1")).toEqual({
      locked: false,
      retryAfter: 0,
    });
    expect(await recordFailure("a@x.com", "1.1.1.1")).toEqual({
      locked: false,
      retryAfter: 0,
    });
    await expect(clearFailures("a@x.com", "1.1.1.1")).resolves.toBeUndefined();
  });
});

describe("with Redis", () => {
  beforeEach(() => {
    h.on = true;
    vi.stubEnv("LOGIN_MAX_ATTEMPTS", "3");
    vi.stubEnv("LOGIN_LOCKOUT_MINUTES", "15");
  });

  it("locks once failures reach the threshold and arms a TTL", async () => {
    expect((await recordFailure("a@x.com", "1.1.1.1")).locked).toBe(false);
    expect((await recordFailure("a@x.com", "1.1.1.1")).locked).toBe(false);
    const third = await recordFailure("a@x.com", "1.1.1.1");
    expect(third.locked).toBe(true);
    expect(third.retryAfter).toBe(900); // armed window TTL
    // a subsequent read-only check still reports locked
    expect((await checkLockout("a@x.com", "1.1.1.1")).locked).toBe(true);
  });

  it("locks by IP even when the email differs (spray protection)", async () => {
    await recordFailure("a@x.com", "9.9.9.9");
    await recordFailure("b@x.com", "9.9.9.9");
    const third = await recordFailure("c@x.com", "9.9.9.9");
    expect(third.locked).toBe(true); // the shared IP counter tripped
  });

  it("clearing failures unlocks", async () => {
    await recordFailure("a@x.com", "1.1.1.1");
    await recordFailure("a@x.com", "1.1.1.1");
    await recordFailure("a@x.com", "1.1.1.1");
    expect((await checkLockout("a@x.com", "1.1.1.1")).locked).toBe(true);
    await clearFailures("a@x.com", "1.1.1.1");
    expect((await checkLockout("a@x.com", "1.1.1.1")).locked).toBe(false);
  });

  it("ignores unknown IP and empty email when building keys", async () => {
    // empty email + unknown ip → no keys → never locks no matter how many calls
    for (let i = 0; i < 10; i++) await recordFailure("", "unknown");
    expect(await checkLockout("", "unknown")).toEqual({ locked: false, retryAfter: 0 });
  });
});
