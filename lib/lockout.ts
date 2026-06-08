// Login brute-force lockout. Counts *failed* password attempts per email and per
// IP; once a counter reaches the threshold within the window, that identity is
// locked until the window's TTL expires. A successful sign-in clears the
// counters. Dormant until Upstash is configured — every call fails OPEN (never
// locked) with no Redis, so the app stays usable in mock mode.

import { redis, hasRedisEnv } from "@/lib/redis/client";

export function maxAttempts(): number {
  const n = Number(process.env.LOGIN_MAX_ATTEMPTS ?? 5);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 5;
}

export function lockoutWindowSec(): number {
  const mins = Number(process.env.LOGIN_LOCKOUT_MINUTES ?? 15);
  const m = Number.isFinite(mins) && mins > 0 ? mins : 15;
  return Math.floor(m * 60);
}

// Pure: a counter at/above the threshold means locked.
export function isLockedOut(failCount: number, threshold = maxAttempts()): boolean {
  return failCount >= threshold;
}

// Pure: human "try again in …" label from a seconds-remaining value.
export function retryAfterLabel(sec: number): string {
  if (sec <= 0) return "a moment";
  if (sec < 60) return `${Math.ceil(sec)} seconds`;
  const mins = Math.ceil(sec / 60);
  return `${mins} minute${mins === 1 ? "" : "s"}`;
}

export interface LockState {
  locked: boolean;
  retryAfter: number; // seconds until unlock (0 when unlocked / dormant)
}

const UNLOCKED: LockState = { locked: false, retryAfter: 0 };

function keysFor(email: string, ip: string): string[] {
  const keys: string[] = [];
  const e = email.trim().toLowerCase();
  if (e) keys.push(`arbor:lock:email:${e}`);
  if (ip && ip !== "unknown") keys.push(`arbor:lock:ip:${ip}`);
  return keys;
}

// Read-only: is this email / IP currently locked? Fails OPEN on dormant / error.
export async function checkLockout(email: string, ip: string): Promise<LockState> {
  if (!hasRedisEnv()) return UNLOCKED;
  const keys = keysFor(email, ip);
  if (keys.length === 0) return UNLOCKED;
  const threshold = maxAttempts();
  try {
    const r = redis();
    let retryAfter = 0;
    for (const k of keys) {
      const count = Number((await r.get<number>(k)) ?? 0);
      if (isLockedOut(count, threshold)) {
        const ttl = await r.ttl(k); // seconds; -1 no-expire, -2 missing
        retryAfter = Math.max(retryAfter, ttl > 0 ? ttl : lockoutWindowSec());
      }
    }
    return { locked: retryAfter > 0, retryAfter };
  } catch {
    return UNLOCKED;
  }
}

// Record one failed attempt. The first failure arms the TTL window. Returns the
// resulting lock state. No-op (unlocked) when dormant / on error.
export async function recordFailure(email: string, ip: string): Promise<LockState> {
  if (!hasRedisEnv()) return UNLOCKED;
  const keys = keysFor(email, ip);
  if (keys.length === 0) return UNLOCKED;
  const threshold = maxAttempts();
  const window = lockoutWindowSec();
  try {
    const r = redis();
    let retryAfter = 0;
    for (const k of keys) {
      const count = await r.incr(k);
      if (count === 1) await r.expire(k, window);
      if (isLockedOut(count, threshold)) {
        const ttl = await r.ttl(k);
        retryAfter = Math.max(retryAfter, ttl > 0 ? ttl : window);
      }
    }
    return { locked: retryAfter > 0, retryAfter };
  } catch {
    return UNLOCKED;
  }
}

// Clear the counters after a successful sign-in. Best-effort.
export async function clearFailures(email: string, ip: string): Promise<void> {
  if (!hasRedisEnv()) return;
  const keys = keysFor(email, ip);
  if (keys.length === 0) return;
  try {
    await redis().del(...keys);
  } catch {
    /* best-effort */
  }
}
