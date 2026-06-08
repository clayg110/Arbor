"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { STATUS_LABEL, type StatusLevel } from "@/lib/status";

interface StatusPayload {
  status: StatusLevel;
  mode: "live" | "mock";
  checks: Record<string, boolean>;
  db?: "ok" | "error";
  freshness?: {
    stale: boolean;
    ageHours: number | null;
    lastSignalAt: string | null;
    maxAgeHours: number;
  } | null;
  pipelines?: { pipeline: string; ranAt: string; errors: number; ok: boolean }[];
  time: string;
}

const DOT: Record<StatusLevel, string> = {
  operational: "#157A5A",
  degraded: "#C0322F",
  mock: "#8A8880",
};

const CHECK_LABELS: Record<string, string> = {
  supabase: "Database & auth (Supabase)",
  anthropic: "Signal extraction (Anthropic)",
  redis: "Rate limiting & lockout (Upstash)",
  sentry: "Error tracking (Sentry)",
  turnstile: "Bot protection (Turnstile)",
};

export default function StatusPage() {
  const [data, setData] = useState<StatusPayload | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch("/api/status", { cache: "no-store" });
      setData((await res.json()) as StatusPayload);
    } catch {
      setError(true);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 30_000); // gentle auto-refresh
    return () => clearInterval(id);
  }, [load]);

  const level: StatusLevel = error ? "degraded" : (data?.status ?? "mock");

  return (
    <div className="mx-auto min-h-screen max-w-2xl px-6 py-12">
      <div className="mb-8 flex items-center justify-between">
        <Link href="/" className="text-[16px] font-medium text-ink">
          Arbor
        </Link>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="rounded-md px-2.5 py-1.5 text-[12px] font-medium text-muted hover:text-ink disabled:opacity-50"
          style={{ border: "0.5px solid var(--border)" }}
        >
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {/* overall banner */}
      <div
        className="flex items-center gap-3 rounded-xl bg-surface p-5"
        style={{ border: "0.5px solid var(--border)" }}
      >
        <span
          className="h-3 w-3 shrink-0 rounded-full"
          style={{ backgroundColor: DOT[level] }}
          aria-hidden
        />
        <div>
          <div className="text-[15px] font-medium text-ink">
            {error ? "Unable to reach status service" : STATUS_LABEL[level]}
          </div>
          {data && (
            <div className="text-[12px] text-muted">
              Last checked {new Date(data.time).toLocaleString()}
            </div>
          )}
        </div>
      </div>

      {/* integrations */}
      {data && (
        <section className="mt-8">
          <h2 className="mb-3 text-[13px] font-medium text-ink">Integrations</h2>
          <div
            className="overflow-hidden rounded-lg bg-surface"
            style={{ border: "0.5px solid var(--border)" }}
          >
            {Object.entries(data.checks).map(([key, on], i) => (
              <Row
                key={key}
                label={CHECK_LABELS[key] ?? key}
                state={on ? "Configured" : "Not configured"}
                tone={on ? "ok" : "off"}
                first={i === 0}
              />
            ))}
          </div>
        </section>
      )}

      {/* data freshness */}
      {data?.freshness && (
        <section className="mt-6">
          <h2 className="mb-3 text-[13px] font-medium text-ink">Data freshness</h2>
          <div
            className="overflow-hidden rounded-lg bg-surface"
            style={{ border: "0.5px solid var(--border)" }}
          >
            <Row
              label="Latest signal ingested"
              state={
                data.freshness.lastSignalAt
                  ? `${formatAge(data.freshness.ageHours)} ago (SLA ${data.freshness.maxAgeHours}h)`
                  : "No signals yet"
              }
              tone={data.freshness.stale ? "warn" : "ok"}
              first
            />
          </div>
        </section>
      )}

      {/* pipelines */}
      {data?.pipelines && data.pipelines.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-3 text-[13px] font-medium text-ink">Pipelines</h2>
          <div
            className="overflow-hidden rounded-lg bg-surface"
            style={{ border: "0.5px solid var(--border)" }}
          >
            {data.pipelines.map((p, i) => (
              <Row
                key={p.pipeline}
                label={p.pipeline}
                state={`${p.ok ? "Healthy" : "Errors"} · ran ${new Date(
                  p.ranAt
                ).toLocaleString()}${p.errors ? ` · ${p.errors} errors` : ""}`}
                tone={p.ok ? "ok" : "warn"}
                first={i === 0}
              />
            ))}
          </div>
        </section>
      )}

      <p className="mt-10 text-center text-[11px] text-subtle">
        Auto-refreshes every 30 seconds.
      </p>
    </div>
  );
}

const TONE: Record<"ok" | "warn" | "off", string> = {
  ok: "#157A5A",
  warn: "#C0322F",
  off: "#8A8880",
};

function Row({
  label,
  state,
  tone,
  first,
}: {
  label: string;
  state: string;
  tone: "ok" | "warn" | "off";
  first: boolean;
}) {
  return (
    <div
      className="flex items-center justify-between gap-3 px-4 py-3"
      style={first ? undefined : { borderTop: "0.5px solid var(--border)" }}
    >
      <span className="text-[13px] text-ink">{label}</span>
      <span className="flex items-center gap-2 text-[12px] text-muted">
        {state}
        <span
          className="h-2 w-2 rounded-full"
          style={{ backgroundColor: TONE[tone] }}
          aria-hidden
        />
      </span>
    </div>
  );
}

function formatAge(hours: number | null): string {
  if (hours == null) return "unknown";
  if (hours < 1) return `${Math.max(1, Math.round(hours * 60))}m`;
  if (hours < 48) return `${Math.round(hours)}h`;
  return `${Math.round(hours / 24)}d`;
}
