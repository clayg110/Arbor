// Generic exponential-backoff retry for transient failures (LLM 429/5xx,
// flaky upstream fetches). Pure + injectable sleep so it's unit-testable without
// real timers. Never retries non-transient errors (4xx other than 429).

const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

// Treat 429 + 5xx as transient; other 4xx are permanent; a missing status
// (network error / timeout / abort) is transient.
export function isTransient(e: unknown): boolean {
  const status = (e as { status?: number } | null)?.status ?? 0;
  if (status === 429 || status >= 500) return true;
  if (status >= 400) return false;
  return true;
}

export interface RetryOpts {
  retries?: number; // extra attempts after the first (default 3)
  baseMs?: number; // first backoff (default 500)
  factor?: number; // backoff multiplier (default 2)
  jitter?: boolean; // randomize 1x–2x to avoid thundering herd (default true)
  retryable?: (e: unknown) => boolean;
  sleepFn?: (ms: number) => Promise<void>;
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: RetryOpts = {}
): Promise<T> {
  const {
    retries = 3,
    baseMs = 500,
    factor = 2,
    jitter = true,
    retryable = isTransient,
    sleepFn = defaultSleep,
  } = opts;

  let attempt = 0;
  for (;;) {
    try {
      return await fn();
    } catch (e) {
      if (attempt >= retries || !retryable(e)) throw e;
      const backoff = baseMs * factor ** attempt;
      await sleepFn(jitter ? backoff * (1 + Math.random()) : backoff);
      attempt++;
    }
  }
}

// Throw on a retryable HTTP status so a fetch (which resolves on 5xx) re-runs
// under withRetry. Returns the response unchanged otherwise.
export function throwIfRetryableStatus(res: Response): Response {
  if (res.status === 429 || res.status >= 500) {
    throw Object.assign(new Error(`upstream ${res.status}`), { status: res.status });
  }
  return res;
}
