"use client";

import { useEffect, useState } from "react";
import { api, BackendOff, type FundView } from "@/lib/api-client";
import { mockFunds } from "@/lib/mock-data";

// Assign this deal to a fund (or none). Drives the LP / fund-level report.
export function FundPickerSection({
  companyId,
  initialFundId,
}: {
  companyId: string;
  initialFundId: string | null;
}) {
  const [funds, setFunds] = useState<FundView[]>([]);
  const [fundId, setFundId] = useState<string | null>(initialFundId);
  const [saving, setSaving] = useState(false);
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    api
      .listFunds()
      .then((r) => setFunds(r.funds))
      .catch((e) => {
        if (e instanceof BackendOff) {
          setFunds(mockFunds);
          setOffline(true);
        }
      });
  }, []);

  async function assign(next: string | null) {
    setFundId(next);
    setSaving(true);
    try {
      await api.assignFund(companyId, next);
    } catch {
      // best-effort; mock mode has no backend
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <select
        value={fundId ?? ""}
        onChange={(e) => assign(e.target.value || null)}
        disabled={saving || offline}
        aria-label="Assign fund"
        className="rounded-md bg-surface px-2.5 py-1.5 text-[12px] text-ink focus:outline-none focus-ring disabled:opacity-50"
        style={{ border: "0.5px solid var(--border)" }}
      >
        <option value="">No fund</option>
        {funds.map((f) => (
          <option key={f.id} value={f.id}>
            {f.name}
            {f.vintageYear != null ? ` (${f.vintageYear})` : ""}
          </option>
        ))}
      </select>
      {saving && <span className="text-[11px] text-subtle">Saving…</span>}
      {offline && (
        <span className="text-[11px] text-subtle">Connect a backend to assign</span>
      )}
    </div>
  );
}
