// Pure load-test math + pass/fail evaluation. Kept dependency-free and separate
// from the runner so it can be unit-tested (tests/loadtest.test.ts) and reused.

// Nearest-rank percentile over an ascending-sorted array of latencies (ms).
export function percentile(sortedMs, p) {
  if (sortedMs.length === 0) return 0;
  const rank = Math.ceil((p / 100) * sortedMs.length);
  const idx = Math.min(sortedMs.length - 1, Math.max(0, rank - 1));
  return sortedMs[idx];
}

// Roll raw samples (successful request latencies) + an error count + the wall
// clock into the headline numbers.
export function summarize(samples, errors, elapsedMs) {
  const sorted = [...samples].sort((a, b) => a - b);
  const total = samples.length + errors;
  return {
    requests: total,
    errors,
    errorRate: total ? errors / total : 0,
    rps: elapsedMs > 0 ? (total / elapsedMs) * 1000 : 0,
    p50: percentile(sorted, 50),
    p95: percentile(sorted, 95),
    p99: percentile(sorted, 99),
    max: sorted.length ? sorted[sorted.length - 1] : 0,
  };
}

// Compare a summary against a budget. Any field left undefined in the budget is
// not enforced. Returns the verdict + a list of human-readable breach strings.
export function evaluateLoad(stats, budget) {
  const failures = [];
  if (budget.p95 != null && stats.p95 > budget.p95) {
    failures.push(`p95 ${Math.round(stats.p95)}ms > ${budget.p95}ms`);
  }
  if (budget.p99 != null && stats.p99 > budget.p99) {
    failures.push(`p99 ${Math.round(stats.p99)}ms > ${budget.p99}ms`);
  }
  if (budget.errorRate != null && stats.errorRate > budget.errorRate) {
    failures.push(
      `error rate ${(stats.errorRate * 100).toFixed(2)}% > ${(budget.errorRate * 100).toFixed(2)}%`
    );
  }
  return { pass: failures.length === 0, failures };
}
