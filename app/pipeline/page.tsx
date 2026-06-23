"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { api, BackendOff } from "@/lib/api-client";
import {
  pipelineFunnel,
  ownerWorkload,
  sectorConcentration,
  upcomingKeyDates,
  staleDeals,
  type PipelineDeal,
} from "@/lib/pipeline";
import {
  PROCESS_STAGE_LABELS,
  PROCESS_STAGE_COLORS,
  isTerminalStage,
} from "@/lib/process-stage";
import { SECTOR_LABELS } from "@/lib/colors";
import { getMockPipelineDeals } from "@/lib/mock-data";
import { EmptyState } from "@/components/ui/primitives";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
} from "recharts";

const TODAY = new Date().toISOString().slice(0, 10);

function daysColor(days: number): string {
  if (days > 45) return "#C0322F";
  if (days > 21) return "#8A5712";
  return "#157A5A";
}

function ownerLabel(email: string | null, id: string | null): string {
  if (!email && !id) return "Unassigned";
  if (email) return email.split("@")[0] ?? email;
  return id!.slice(0, 8);
}

export default function PipelinePage() {
  const [deals, setDeals] = useState<PipelineDeal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .getPipelineDeals()
      .then((r) => setDeals(r.deals))
      .catch((e) => {
        if (e instanceof BackendOff) setDeals(getMockPipelineDeals());
      })
      .finally(() => setLoading(false));
  }, []);

  const active = useMemo(
    () => deals.filter((d) => !isTerminalStage(d.ourProcessStage)),
    [deals]
  );
  const funnel = useMemo(() => pipelineFunnel(deals), [deals]);
  const owners = useMemo(() => ownerWorkload(active), [active]);
  const sectors = useMemo(() => sectorConcentration(active), [active]);
  const upcoming = useMemo(() => upcomingKeyDates(active, TODAY, 30), [active]);
  const stale = useMemo(() => staleDeals(active, 30), [active]);
  const withBids = active.filter((d) => d.bidCount > 0);

  if (loading) {
    return (
      <div className="py-16 text-center text-[13px] text-subtle">Loading pipeline…</div>
    );
  }

  if (deals.length === 0) {
    return (
      <EmptyState
        title="No active processes yet"
        hint={"Set “Our process” stage on a company to track it here."}
        action={
          <Link href="/radar" className="text-[13px] text-[#185FA5] hover:underline">
            Go to radar →
          </Link>
        }
      />
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-[20px] font-medium text-ink">Pipeline</h1>
        <p className="mt-1 text-[13px] text-subtle">
          Your team&apos;s active deal processes
        </p>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard label="Active processes" value={active.length} />
        <KpiCard label="With bids recorded" value={withBids.length} />
        <KpiCard
          label="Stale (>30 days)"
          value={stale.length}
          valueColor={stale.length > 0 ? "#C0322F" : undefined}
        />
        <KpiCard label="Upcoming dates (30d)" value={upcoming.length} />
      </div>

      {/* funnel + upcoming side-by-side */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[2fr_1fr]">
        {/* funnel */}
        <section>
          <h2 className="mb-3 text-[14px] font-medium text-ink">Process funnel</h2>
          {funnel.length === 0 ? (
            <p className="text-[13px] text-subtle">No active processes.</p>
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(funnel.length * 38, 100)}>
              <BarChart
                data={funnel}
                layout="vertical"
                margin={{ left: 120, right: 32, top: 4, bottom: 4 }}
                barSize={18}
              >
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                <YAxis
                  type="category"
                  dataKey="label"
                  width={115}
                  tick={{ fontSize: 12 }}
                />
                <Tooltip
                  formatter={(v) => [v, "deals"]}
                  contentStyle={{ fontSize: 12 }}
                />
                <Bar dataKey="count" radius={[0, 3, 3, 0]}>
                  {funnel.map((entry) => {
                    const c = PROCESS_STAGE_COLORS[entry.stage];
                    return <Cell key={entry.stage} fill={c.text} />;
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </section>

        {/* upcoming key dates */}
        <section>
          <h2 className="mb-3 text-[14px] font-medium text-ink">
            Upcoming dates{upcoming.length > 0 ? ` (${upcoming.length})` : ""}
          </h2>
          {upcoming.length === 0 ? (
            <p className="text-[13px] text-subtle">No key dates in the next 30 days.</p>
          ) : (
            <ul className="space-y-2">
              {upcoming.map((u, i) => (
                <li
                  key={`${u.companyId}-${u.stage}-${i}`}
                  className="rounded-md border border-[var(--border)] bg-[#FAFAF8] px-3 py-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <Link
                      href={`/company/${u.companyId}`}
                      className="truncate text-[12px] font-medium text-[#185FA5] hover:underline"
                    >
                      {u.companyName}
                    </Link>
                    <span
                      className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium"
                      style={{
                        background: u.daysUntil <= 7 ? "#fef2f2" : "#eff6ff",
                        color: u.daysUntil <= 7 ? "#C0322F" : "#1d4ed8",
                      }}
                    >
                      {u.daysUntil === 0 ? "Today" : `${u.daysUntil}d`}
                    </span>
                  </div>
                  <p className="text-[11px] text-subtle">
                    {u.stageLabel} ·{" "}
                    {new Date(u.date + "T00:00:00").toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* deal table */}
      <section>
        <h2 className="mb-3 text-[14px] font-medium text-ink">
          All processes ({active.length})
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[12px]">
            <thead>
              <tr className="border-b border-[var(--border)]">
                <Th>Company</Th>
                <Th>Stage</Th>
                <Th>Days in stage</Th>
                <Th>Key date</Th>
                <Th>Bids</Th>
                <Th>Avg multiple</Th>
                <Th>Owner</Th>
              </tr>
            </thead>
            <tbody>
              {deals.map((deal) => {
                const c = PROCESS_STAGE_COLORS[deal.ourProcessStage];
                const nextDate = deal.keyDates[deal.ourProcessStage];
                return (
                  <tr
                    key={deal.companyId}
                    className="border-b border-[var(--border)] hover:bg-[#F5F4EF]"
                  >
                    <td className="py-2 pr-4">
                      <Link
                        href={`/company/${deal.companyId}`}
                        className="font-medium text-[#185FA5] hover:underline"
                      >
                        {deal.companyName}
                      </Link>
                      <div className="text-[10px] text-subtle">
                        {(SECTOR_LABELS as Record<string, string>)[deal.sector] ??
                          deal.sector}
                      </div>
                    </td>
                    <td className="py-2 pr-4">
                      <span
                        className="rounded px-1.5 py-0.5 text-[11px] font-medium"
                        style={{
                          background: c.bg,
                          color: c.text,
                          border: `1px solid ${c.border}`,
                        }}
                      >
                        {PROCESS_STAGE_LABELS[deal.ourProcessStage]}
                      </span>
                    </td>
                    <td className="py-2 pr-4">
                      <span
                        className="font-medium"
                        style={{ color: daysColor(deal.daysInStage) }}
                      >
                        {deal.daysInStage}d
                      </span>
                    </td>
                    <td className="py-2 pr-4 text-subtle">
                      {nextDate
                        ? new Date(nextDate + "T00:00:00").toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                          })
                        : "—"}
                    </td>
                    <td className="py-2 pr-4 text-ink">{deal.bidCount || "—"}</td>
                    <td className="py-2 pr-4 text-ink">
                      {deal.avgBidMultiple !== null
                        ? `${deal.avgBidMultiple.toFixed(1)}x`
                        : "—"}
                    </td>
                    <td className="py-2 text-subtle">
                      {ownerLabel(deal.ownerEmail, deal.ownerId)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* owner workload + sector concentration */}
      {(owners.length > 0 || sectors.length > 0) && (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          {owners.length > 1 && (
            <section>
              <h2 className="mb-3 text-[14px] font-medium text-ink">Team workload</h2>
              <ul className="space-y-2">
                {owners.map((o) => (
                  <li key={o.ownerId ?? "unassigned"} className="flex items-center gap-2">
                    <span className="w-28 shrink-0 truncate text-[12px] text-subtle">
                      {ownerLabel(o.ownerEmail, o.ownerId)}
                    </span>
                    <div
                      className="flex-1 rounded-full bg-[#F1EFE8]"
                      style={{ height: 8 }}
                    >
                      <div
                        className="rounded-full bg-[#185FA5]"
                        style={{
                          height: 8,
                          width: `${Math.round((o.count / active.length) * 100)}%`,
                        }}
                      />
                    </div>
                    <span className="w-6 text-right text-[12px] font-medium text-ink">
                      {o.count}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {sectors.length > 0 && (
            <section>
              <h2 className="mb-3 text-[14px] font-medium text-ink">
                Sector concentration
              </h2>
              <ResponsiveContainer
                width="100%"
                height={Math.max(sectors.length * 32, 80)}
              >
                <BarChart
                  data={sectors.map((s) => ({
                    ...s,
                    label:
                      (SECTOR_LABELS as Record<string, string>)[s.sector] ?? s.sector,
                  }))}
                  layout="vertical"
                  margin={{ left: 100, right: 24, top: 2, bottom: 2 }}
                  barSize={14}
                >
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 10 }} />
                  <YAxis
                    type="category"
                    dataKey="label"
                    width={95}
                    tick={{ fontSize: 11 }}
                  />
                  <Tooltip
                    formatter={(v) => [v, "processes"]}
                    contentStyle={{ fontSize: 11 }}
                  />
                  <Bar dataKey="count" fill="#185FA5" radius={[0, 3, 3, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

function KpiCard({
  label,
  value,
  valueColor,
}: {
  label: string;
  value: number;
  valueColor?: string;
}) {
  return (
    <div
      className="rounded-md border border-[var(--border)] bg-white px-4 py-3"
      style={{ boxShadow: "0 1px 2px rgba(0,0,0,.04)" }}
    >
      <p className="text-[11px] text-subtle">{label}</p>
      <p
        className="mt-1 text-[22px] font-medium leading-none"
        style={{ color: valueColor ?? "var(--ink)" }}
      >
        {value}
      </p>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="pb-2 pr-4 text-left text-[11px] font-medium text-subtle">
      {children}
    </th>
  );
}
