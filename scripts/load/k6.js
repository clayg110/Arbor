// k6 load test (https://k6.io) — the heavier, standard-tooling counterpart to
// run.mjs. Install k6, start the app (or point BASE_URL at a deployment), then:
//
//   k6 run scripts/load/k6.js
//   BASE_URL=https://arbor.example.com VUS=50 API_KEY=ak_live_… k6 run scripts/load/k6.js
//
// Thresholds below make k6 exit non-zero on a breach, so it drops into CI as a
// gate. Only public endpoints are hit by default; set API_KEY / COOKIE to also
// exercise the keyed (api/v1) and authed (feed/search) read paths.

import http from "k6/http";
import { check, sleep } from "k6";

const BASE = __ENV.BASE_URL || "http://localhost:3000";
const VUS = Number(__ENV.VUS || 20);
const API_KEY = __ENV.API_KEY || "";
const COOKIE = __ENV.COOKIE || "";

export const options = {
  stages: [
    { duration: "30s", target: VUS }, // ramp up
    { duration: "1m", target: VUS }, // hold
    { duration: "10s", target: 0 }, // ramp down
  ],
  thresholds: {
    http_req_failed: ["rate<0.01"], // <1% errors
    http_req_duration: ["p(95)<500", "p(99)<1000"],
  },
};

function urls() {
  const list = [`${BASE}/api/health`, `${BASE}/api/status`, `${BASE}/landing`];
  return list;
}

export default function () {
  for (const url of urls()) {
    const res = http.get(url);
    check(res, { "status < 400": (r) => r.status < 400 });
  }

  if (API_KEY) {
    const res = http.get(`${BASE}/api/v1/companies`, {
      headers: { Authorization: `Bearer ${API_KEY}` },
    });
    check(res, { "v1 status < 400": (r) => r.status < 400 });
  }

  if (COOKIE) {
    const headers = { Cookie: COOKIE };
    check(http.get(`${BASE}/api/feed`, { headers }), {
      "feed status < 400": (r) => r.status < 400,
    });
    check(http.get(`${BASE}/api/search?q=acme`, { headers }), {
      "search status < 400": (r) => r.status < 400,
    });
  }

  sleep(1);
}
