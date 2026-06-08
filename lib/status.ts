// Overall system-status rollup for the public /status page. Pure so the
// degraded/operational logic is unit-testable independent of the data fetch.

export type StatusLevel = "operational" | "degraded" | "mock";

export interface StatusInputs {
  mode: "live" | "mock";
  db?: "ok" | "error";
  freshnessStale?: boolean;
  pipelines?: { ok: boolean }[];
}

// Degraded if the DB is unreachable, data has gone stale past its SLA, or any
// pipeline's latest run failed. Mock mode is reported as-is (nothing to monitor).
export function computeStatus(i: StatusInputs): StatusLevel {
  if (i.mode === "mock") return "mock";
  if (i.db === "error") return "degraded";
  if (i.freshnessStale) return "degraded";
  if (i.pipelines?.some((p) => !p.ok)) return "degraded";
  return "operational";
}

export const STATUS_LABEL: Record<StatusLevel, string> = {
  operational: "All systems operational",
  degraded: "Degraded — some checks need attention",
  mock: "Mock mode — backend not configured",
};
