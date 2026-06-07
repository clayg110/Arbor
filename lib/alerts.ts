// Best-effort operational alerts. Posts to a Slack-compatible incoming webhook
// (ALERT_WEBHOOK_URL) when set; otherwise a no-op. Never throws to callers — a
// broken alert channel must not take down a pipeline.

export interface PipelineReport {
  pipeline: string;
  fetched: number;
  created: number;
  updated: number;
  flagged: number;
  errors: number;
}

export function hasAlertEnv(): boolean {
  return !!process.env.ALERT_WEBHOOK_URL;
}

export async function sendAlert(text: string): Promise<boolean> {
  const url = process.env.ALERT_WEBHOOK_URL;
  if (!url) return false;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
      signal: AbortSignal.timeout(5000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// Alert only when a run logged errors. Safe to call unconditionally — returns
// false (no dispatch) when errors <= 0.
export async function notifyPipelineFailure(r: PipelineReport): Promise<boolean> {
  if (r.errors <= 0) return false;
  const text =
    `⚠ Arbor pipeline "${r.pipeline}" finished with ${r.errors} error${r.errors === 1 ? "" : "s"}.\n` +
    `fetched ${r.fetched} · created ${r.created} · updated ${r.updated} · flagged ${r.flagged}`;
  return sendAlert(text);
}

// Alert on a hard crash (pipeline threw before completing).
export async function notifyPipelineCrash(pipeline: string, err: unknown): Promise<boolean> {
  const msg = err instanceof Error ? err.message : String(err);
  return sendAlert(`🚨 Arbor pipeline "${pipeline}" crashed: ${msg}`);
}
