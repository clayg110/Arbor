// Dependency-free load test. Uses Node's global fetch + a fixed pool of async
// workers to hammer a set of read endpoints for a fixed duration, then prints
// per-target latency/throughput and fails (exit 1) if any target breaches the
// budget. No external tool required — `pnpm load`. For heavier, distributed runs
// use the k6 script alongside this (scripts/load/k6.js).
//
// Config (env):
//   BASE_URL      target origin            (default http://localhost:3000)
//   DURATION_S    seconds per target       (default 15)
//   CONCURRENCY   parallel workers         (default 20)
//   API_KEY       enables /api/v1/companies (Authorization: Bearer)
//   COOKIE        session cookie → adds the authed read endpoints (feed/search)
//   LOAD_P95 / LOAD_P99 / LOAD_ERR  budget overrides (ms / ms / fraction)

import { summarize, evaluateLoad } from "./budget.mjs";

const BASE = process.env.BASE_URL || "http://localhost:3000";
const DURATION_S = Number(process.env.DURATION_S || 15);
const CONCURRENCY = Number(process.env.CONCURRENCY || 20);
const API_KEY = process.env.API_KEY || "";
const COOKIE = process.env.COOKIE || "";

const BUDGET = {
  p95: Number(process.env.LOAD_P95 || 500),
  p99: Number(process.env.LOAD_P99 || 1000),
  errorRate: Number(process.env.LOAD_ERR || 0.01),
};

// Always safe (public). The authed/keyed ones switch on only when creds exist.
const targets = [
  { name: "GET /api/health", path: "/api/health" },
  { name: "GET /api/status", path: "/api/status" },
  { name: "GET /landing", path: "/landing" },
];
if (API_KEY) {
  targets.push({
    name: "GET /api/v1/companies",
    path: "/api/v1/companies",
    headers: { authorization: `Bearer ${API_KEY}` },
  });
}
if (COOKIE) {
  targets.push({ name: "GET /api/feed", path: "/api/feed", headers: { cookie: COOKIE } });
  targets.push({
    name: "GET /api/search?q=acme",
    path: "/api/search?q=acme",
    headers: { cookie: COOKIE },
  });
}

async function runTarget(target) {
  const url = BASE + target.path;
  const headers = target.headers || {};
  const deadline = Date.now() + DURATION_S * 1000;
  const samples = [];
  let errors = 0;

  async function worker() {
    while (Date.now() < deadline) {
      const t0 = performance.now();
      try {
        const res = await fetch(url, { headers, redirect: "manual" });
        // Drain the body so the connection is reusable / timing is honest.
        await res.arrayBuffer();
        const dt = performance.now() - t0;
        if (res.status >= 500) errors++;
        else samples.push(dt);
      } catch {
        errors++;
      }
    }
  }

  const start = performance.now();
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  const elapsed = performance.now() - start;

  return summarize(samples, errors, elapsed);
}

function fmt(stats) {
  return (
    `req=${stats.requests} err=${stats.errors} ` +
    `rps=${stats.rps.toFixed(0)} ` +
    `p50=${Math.round(stats.p50)}ms p95=${Math.round(stats.p95)}ms ` +
    `p99=${Math.round(stats.p99)}ms max=${Math.round(stats.max)}ms`
  );
}

async function main() {
  console.log(
    `Load test → ${BASE}  (${CONCURRENCY} workers × ${DURATION_S}s/target)\n` +
      `Budget: p95<${BUDGET.p95}ms p99<${BUDGET.p99}ms err<${(BUDGET.errorRate * 100).toFixed(2)}%\n`
  );

  let failed = false;
  for (const target of targets) {
    const stats = await runTarget(target);
    const { pass, failures } = evaluateLoad(stats, BUDGET);
    console.log(`${pass ? "PASS" : "FAIL"}  ${target.name}`);
    console.log(`      ${fmt(stats)}`);
    if (!pass) {
      failed = true;
      console.log(`      ✗ ${failures.join("; ")}`);
    }
  }

  console.log(
    `\n${failed ? "Load test FAILED — budget breached." : "Load test passed."}`
  );
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error("Load test crashed:", e);
  process.exit(1);
});
