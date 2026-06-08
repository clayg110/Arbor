// Minimal circuit breaker. Guards a flaky dependency (e.g. the LLM API) inside a
// pipeline run: after `threshold` consecutive failures it opens and callers skip
// the dependency until `cooldownMs` elapses, then allows one trial (half-open) —
// a success closes it, a failure re-opens. `now` is injectable for tests.

export interface BreakerOpts {
  threshold?: number;
  cooldownMs?: number;
  now?: () => number;
}

export class CircuitBreaker {
  private failures = 0;
  private openedAt = 0;
  private readonly threshold: number;
  private readonly cooldownMs: number;
  private readonly now: () => number;

  constructor(opts: BreakerOpts = {}) {
    this.threshold = opts.threshold ?? 5;
    this.cooldownMs = opts.cooldownMs ?? 60_000;
    this.now = opts.now ?? Date.now;
  }

  // Open = stop calling. Once the cooldown passes we report closed to allow a
  // single half-open trial (the next recordFailure re-opens if it fails).
  isOpen(): boolean {
    if (this.openedAt === 0) return false;
    return this.now() - this.openedAt < this.cooldownMs;
  }

  recordSuccess(): void {
    this.failures = 0;
    this.openedAt = 0;
  }

  recordFailure(): void {
    this.failures++;
    if (this.failures >= this.threshold) this.openedAt = this.now();
  }
}
