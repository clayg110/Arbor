import { redis, hasRedisEnv } from "./client";

export interface Lock {
  release: () => Promise<void>;
}

// Distributed lock (SET NX EX) to stop overlapping pipeline runs.
// Without Redis env, returns a no-op lock (always "acquired").
export async function acquireLock(key: string, ttlSec = 300): Promise<Lock | null> {
  if (!hasRedisEnv()) {
    return { release: async () => {} };
  }
  const token = globalThis.crypto.randomUUID();
  try {
    const res = await redis().set(key, token, { nx: true, ex: ttlSec });
    if (res !== "OK") return null;
  } catch {
    return { release: async () => {} }; // don't block on lock-store failure
  }
  return {
    release: async () => {
      try {
        const cur = await redis().get<string>(key);
        if (cur === token) await redis().del(key);
      } catch {
        // ignore
      }
    },
  };
}
