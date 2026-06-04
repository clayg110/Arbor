"use client";

import { useState } from "react";
import { RefreshIcon } from "./icons";

export function PipelineStatusRow({
  name,
  lastRun,
  records,
  errors,
  schedule,
  onRun,
}: {
  name: string;
  lastRun: string;
  records: number;
  errors: number;
  schedule: string;
  onRun?: () => void | Promise<void>;
}) {
  const [running, setRunning] = useState(false);

  async function run() {
    setRunning(true);
    try {
      await onRun?.();
    } finally {
      setTimeout(() => setRunning(false), 1200);
    }
  }

  return (
    <div
      className="rounded-lg bg-surface px-4 py-3"
      style={{ border: "0.5px solid var(--border)" }}
    >
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        <div className="min-w-[180px] flex-1 text-[13px] font-medium text-ink">
          {name}
        </div>
        <Stat label="Last run" value={lastRun} />
        <Stat label="Records" value={String(records)} />
        <Stat
          label="Errors"
          value={String(errors)}
          color={errors > 0 ? "#791F1F" : undefined}
        />
        <button
          type="button"
          onClick={run}
          disabled={running}
          className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12px] font-medium text-white disabled:opacity-50"
          style={{ backgroundColor: "#185FA5" }}
        >
          <RefreshIcon className={`h-3.5 w-3.5 ${running ? "animate-spin" : ""}`} />
          {running ? "Running…" : "Run now"}
        </button>
      </div>
      <p className="mt-2 text-[11px] font-normal text-subtle">
        Schedule: {schedule}
      </p>
    </div>
  );
}

function Stat({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div className="min-w-[80px]">
      <div className="text-[11px] font-normal text-subtle">{label}</div>
      <div className="text-[13px] font-medium" style={{ color: color ?? "var(--text)" }}>
        {value}
      </div>
    </div>
  );
}
