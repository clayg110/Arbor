import { Ratelimit } from "@upstash/ratelimit";
import { redis, hasRedisEnv } from "./client";

let _rl: Ratelimit | null = null;

function limiter(): Ratelimit {
  if (!_rl) {
    _rl = new Ratelimit({
      redis: redis(),
      limiter: Ratelimit.slidingWindow(Number(process.env.LLM_RATE_PER_MIN ?? 60), "1 m"),
      prefix: "arbor:llm",
    });
  }
  return _rl;
}

// ---- generic request limiter (per IP / per API key / per user) -------------
type Window = `${number} ${"s" | "m" | "h"}`;
const _limiters = new Map<string, Ratelimit>();

function namedLimiter(prefix: string, limit: number, window: Window): Ratelimit {
  const cacheKey = `${prefix}:${limit}:${window}`;
  let rl = _limiters.get(cacheKey);
  if (!rl) {
    rl = new Ratelimit({
      redis: redis(),
      limiter: Ratelimit.slidingWindow(limit, window),
      prefix: `arbor:rl:${prefix}`,
    });
    _limiters.set(cacheKey, rl);
  }
  return rl;
}

export interface RateResult {
  ok: boolean;
  remaining: number;
  reset: number; // epoch ms when the window resets
}

// Check (and consume) one unit for `id` under a named bucket. Fails OPEN: when
// Redis is unconfigured or errors, the request is allowed (never hard-block on
// the limiter). Returns ok=false only when a real limit is exceeded.
export async function rateLimit(
  id: string,
  opts: { limit: number; window: Window; prefix: string }
): Promise<RateResult> {
  if (!hasRedisEnv()) return { ok: true, remaining: opts.limit, reset: 0 };
  try {
    const r = await namedLimiter(opts.prefix, opts.limit, opts.window).limit(id);
    return { ok: r.success, remaining: r.remaining, reset: r.reset };
  } catch {
    return { ok: true, remaining: opts.limit, reset: 0 };
  }
}

// Best-effort client IP from common proxy headers.
export function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

// Block until an LLM slot is free (soft). No-op when Redis is unconfigured.
// Returns false only if it gave up before the deadline (caller proceeds anyway).
export async function waitForLlmSlot(maxWaitMs = 10_000): Promise<boolean> {
  if (!hasRedisEnv()) return true;
  const deadline = Date.now() + maxWaitMs;
  for (;;) {
    try {
      const { success, reset } = await limiter().limit("global");
      if (success) return true;
      const wait = Math.min(Math.max(reset - Date.now(), 250), 2000);
      if (Date.now() + wait > deadline) return false;
      await new Promise((r) => setTimeout(r, wait));
    } catch {
      return true; // never block the pipeline on a limiter failure
    }
  }
}
