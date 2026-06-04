import { Ratelimit } from "@upstash/ratelimit";
import { redis, hasRedisEnv } from "./client";

let _rl: Ratelimit | null = null;

function limiter(): Ratelimit {
  if (!_rl) {
    _rl = new Ratelimit({
      redis: redis(),
      limiter: Ratelimit.slidingWindow(
        Number(process.env.LLM_RATE_PER_MIN ?? 60),
        "1 m"
      ),
      prefix: "arbor:llm",
    });
  }
  return _rl;
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
