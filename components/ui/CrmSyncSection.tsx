"use client";

import { useEffect, useState } from "react";
import { api, BackendOff, type CrmSyncView } from "@/lib/api-client";

// Push this deal to the configured CRM (Affinity, etc.) and show last-sync state.
// Dormant when no CRM env is set — renders a "not configured" hint instead.
export function CrmSyncSection({ companyId }: { companyId: string }) {
  const [configured, setConfigured] = useState<boolean | null>(null); // null = loading
  const [provider, setProvider] = useState<string | null>(null);
  const [sync, setSync] = useState<CrmSyncView | null>(null);
  const [busy, setBusy] = useState(false);
  const [offline, setOffline] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    api
      .crmStatus(companyId)
      .then((r) => {
        setConfigured(r.configured);
        setProvider(r.provider);
        setSync(r.sync);
      })
      .catch((e) => {
        if (e instanceof BackendOff) setOffline(true);
        setConfigured(false);
      });
  }, [companyId]);

  async function push() {
    setBusy(true);
    setErr(null);
    try {
      const r = await api.crmSync(companyId);
      setSync(r.sync);
    } catch (e) {
      setErr(
        e instanceof Error && e.message ? `Sync failed (${e.message}).` : "Sync failed."
      );
    } finally {
      setBusy(false);
    }
  }

  if (offline) {
    return (
      <p className="text-[12px] text-muted">CRM sync requires a connected backend.</p>
    );
  }
  if (configured === null) {
    return <p className="text-[12px] text-subtle">Loading…</p>;
  }
  if (!configured) {
    return (
      <p className="text-[12px] text-muted">
        No CRM is configured. Set an integration key (e.g. <code>AFFINITY_API_KEY</code>)
        to push deals to your CRM.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={push}
          disabled={busy}
          className="rounded-md px-3 py-1.5 text-[12px] font-medium text-white disabled:opacity-50"
          style={{ backgroundColor: "#185FA5" }}
        >
          {busy ? "Pushing…" : `Push to ${provider ?? "CRM"}`}
        </button>
        {sync && (
          <span className="text-[11px] text-subtle">
            {sync.status === "synced" ? "Last synced" : "Last attempt"}{" "}
            {new Date(sync.syncedAt).toLocaleDateString()}
          </span>
        )}
      </div>
      {sync?.status === "error" && sync.error && (
        <p className="text-[12px] text-[#791F1F]">{sync.error}</p>
      )}
      {err && <p className="text-[12px] text-[#791F1F]">{err}</p>}
    </div>
  );
}
