"use client";

import { useMemo, useState } from "react";
import { useLive } from "@/lib/use-live";
import { api, BackendOff, type FundView } from "@/lib/api-client";
import { mockFunds, mockLpReport } from "@/lib/mock-data";
import {
  currentQuarter,
  lpReportToCsv,
  type FundSnapshot,
  type LpReport,
} from "@/lib/lp-report";

// Last 8 calendar quarters, newest first, as selectable options.
function recentQuarters(count = 8): string[] {
  const out: string[] = [];
  const now = new Date();
  let y = now.getUTCFullYear();
  let q = Math.floor(now.getUTCMonth() / 3) + 1;
  for (let i = 0; i < count; i++) {
    out.push(`${y}-Q${q}`);
    q -= 1;
    if (q === 0) {
      q = 4;
      y -= 1;
    }
  }
  return out;
}

export default function LpReportPage() {
  const [quarter, setQuarter] = useState(currentQuarter());
  const quarters = useMemo(() => recentQuarters(), []);

  const reportLive = useLive<{ report: LpReport }>(
    `lp-report:${quarter}`,
    () => api.lpReport(quarter),
    { report: mockLpReport }
  );
  const fundsLive = useLive<{ funds: FundView[] }>("funds", () => api.listFunds(), {
    funds: mockFunds,
  });

  const report = reportLive.data.report;

  function downloadCsv() {
    // Prefer the server stream (respects auth); fall back to client-side CSV in
    // mock mode where the endpoint 503s.
    fetch(`/api/reports/lp?quarter=${encodeURIComponent(quarter)}&format=csv`, {
      cache: "no-store",
    })
      .then((res) => {
        if (!res.ok) throw new BackendOff();
        return res.blob();
      })
      .catch(() => new Blob([lpReportToCsv(report)], { type: "text/csv" }))
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `arbor-lp-${quarter}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      });
  }

  return (
    <div className="mx-auto max-w-[960px]">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[18px] font-medium text-ink">LP / fund report</h1>
          <p className="mt-1 text-[12px] text-muted">
            Quarterly pipeline snapshot grouped by fund vintage and sector.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="quarter" className="text-[12px] text-muted">
            Quarter
          </label>
          <select
            id="quarter"
            value={quarter}
            onChange={(e) => setQuarter(e.target.value)}
            className="rounded-md bg-surface px-2.5 py-1.5 text-[12px] text-ink focus:outline-none focus-ring"
            style={{ border: "0.5px solid var(--border)" }}
          >
            {quarters.map((q) => (
              <option key={q} value={q}>
                {q}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={downloadCsv}
            className="rounded-md px-3 py-1.5 text-[12px] font-medium text-white"
            style={{ backgroundColor: "#185FA5" }}
          >
            Download CSV
          </button>
        </div>
      </div>

      <div className="mb-5 flex gap-3 text-[12px] text-muted">
        <span>
          <span className="font-medium text-ink">{report.totalDeals}</span> deals tracked
        </span>
        <span>·</span>
        <span>
          <span className="font-medium text-ink">{report.funds.length}</span> fund
          {report.funds.length === 1 ? "" : "s"} with activity
        </span>
      </div>

      {report.funds.length === 0 ? (
        <p
          className="rounded-lg bg-surface p-6 text-center text-[13px] text-muted"
          style={{ border: "0.5px solid var(--border)" }}
        >
          No deals assigned to funds yet. Assign deals on a company profile to populate
          this report.
        </p>
      ) : (
        <div className="space-y-4">
          {report.funds.map((s) => (
            <FundCard key={s.fund?.id ?? "unassigned"} snap={s} />
          ))}
        </div>
      )}

      <FundManager funds={fundsLive.data.funds} reload={fundsLive.reload} />
    </div>
  );
}

function FundCard({ snap }: { snap: FundSnapshot }) {
  const name = snap.fund?.name ?? "Unassigned";
  const vintage = snap.fund?.vintageYear;
  return (
    <section
      className="rounded-lg bg-surface p-5"
      style={{ border: "0.5px solid var(--border)" }}
    >
      <div className="mb-4 flex items-baseline justify-between">
        <h2 className="text-[15px] font-medium text-ink">
          {name}
          {vintage != null && (
            <span className="ml-2 text-[12px] font-normal text-muted">
              Vintage {vintage}
            </span>
          )}
        </h2>
        <div className="flex gap-4 text-[12px] text-muted">
          <span>
            <span className="font-medium text-ink">{snap.dealCount}</span> deals
          </span>
          <span>
            <span className="font-medium text-ink">{snap.newThisQuarter}</span> new
          </span>
          {snap.avgConviction != null && (
            <span>
              conviction{" "}
              <span className="font-medium text-ink">{snap.avgConviction}</span>
            </span>
          )}
          <span>
            <span className="font-medium text-ink">{snap.totalBids}</span> bids
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-5">
        <div>
          <h3 className="mb-2 text-[11px] font-medium uppercase tracking-wide text-subtle">
            By stage
          </h3>
          <ul className="space-y-1">
            {snap.byStage.map((st) => (
              <li key={st.stage} className="flex justify-between text-[12px] text-ink">
                <span className="text-muted">{st.label}</span>
                <span className="font-medium">{st.count}</span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="mb-2 text-[11px] font-medium uppercase tracking-wide text-subtle">
            By sector
          </h3>
          <ul className="space-y-1">
            {snap.bySector.map((sec) => (
              <li key={sec.sector} className="flex justify-between text-[12px] text-ink">
                <span className="text-muted">{sec.sector}</span>
                <span className="font-medium">{sec.count}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

function FundManager({ funds, reload }: { funds: FundView[]; reload: () => void }) {
  const [name, setName] = useState("");
  const [vintage, setVintage] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function create() {
    if (!name.trim()) return;
    setBusy(true);
    setErr(null);
    try {
      await api.createFund({
        name: name.trim(),
        vintageYear: vintage ? Number(vintage) : null,
      });
      setName("");
      setVintage("");
      reload();
    } catch (e) {
      setErr(
        e instanceof BackendOff
          ? "Managing funds requires a connected backend."
          : "Could not create fund."
      );
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    try {
      await api.deleteFund(id);
      reload();
    } catch {
      // best-effort; mock mode has no backend
    }
  }

  return (
    <section
      className="mt-8 rounded-lg bg-surface p-5"
      style={{ border: "0.5px solid var(--border)" }}
    >
      <h2 className="text-[14px] font-medium text-ink">Manage funds</h2>
      <p className="mb-3 mt-1 text-[12px] text-muted">
        Create funds, then assign deals to them from a company profile.
      </p>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Fund name"
          className="flex-1 rounded-md bg-surface px-3 py-2 text-[12px] text-ink focus:outline-none focus-ring"
          style={{ border: "0.5px solid var(--border)" }}
        />
        <input
          value={vintage}
          onChange={(e) => setVintage(e.target.value.replace(/[^0-9]/g, "").slice(0, 4))}
          placeholder="Vintage"
          inputMode="numeric"
          className="w-24 rounded-md bg-surface px-3 py-2 text-[12px] text-ink focus:outline-none focus-ring"
          style={{ border: "0.5px solid var(--border)" }}
        />
        <button
          type="button"
          onClick={create}
          disabled={busy || !name.trim()}
          className="rounded-md px-3 py-2 text-[12px] font-medium text-white disabled:opacity-50"
          style={{ backgroundColor: "#185FA5" }}
        >
          Add fund
        </button>
      </div>
      {err && <p className="mb-3 text-[12px] text-[#791F1F]">{err}</p>}

      <ul className="divide-y" style={{ borderColor: "var(--border)" }}>
        {funds.map((f) => (
          <li key={f.id} className="flex items-center justify-between py-2 text-[12px]">
            <span className="text-ink">
              {f.name}
              {f.vintageYear != null && (
                <span className="ml-2 text-muted">· {f.vintageYear}</span>
              )}
              <span className="ml-2 text-subtle">
                {f.dealCount} deal{f.dealCount === 1 ? "" : "s"}
              </span>
            </span>
            <button
              type="button"
              onClick={() => remove(f.id)}
              className="text-subtle hover:text-[#791F1F]"
            >
              Remove
            </button>
          </li>
        ))}
        {funds.length === 0 && (
          <li className="py-2 text-[12px] text-muted">No funds yet.</li>
        )}
      </ul>
    </section>
  );
}
