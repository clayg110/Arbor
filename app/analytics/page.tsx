"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/api-client";
import {
  ResponsiveContainer,
  ComposedChart,
  BarChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  LabelList,
} from "recharts";
import { DateRangeControl } from "@/components/ui/DateRangeControl";
import { useDateRange, type CommittedRange } from "@/components/ui/useDateRange";
import { StageBadge } from "@/components/ui/StageBadge";
import {
  ChartBarIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  ArrowRightIcon,
  DocumentIcon,
  MicIcon,
  GlobeIcon,
  RssIcon,
  PencilIcon,
} from "@/components/ui/icons";
import {
  METRICS,
  metricValue,
  velocity as mockVelocity,
  velocitySummary,
  sectorStage as mockSectorStage,
  dealSplit as mockDealSplit,
  confidenceDist as mockConfidenceDist,
  exitFunnel as mockExitFunnel,
  transitionRates as mockTransitionRates,
  topSectors as mockTopSectors,
  sponsors as mockSponsors,
  sponsorHolding as mockSponsorHolding,
  confidenceCalibration as mockCalibration,
  signalSources as mockSignalSources,
  recentChanges as mockRecentChanges,
  buildHeatmap,
  heatColor,
  tokenToPreset,
  type MetricSpec,
  type SponsorHoldingPoint,
  type ConfidenceCalibrationPoint,
} from "@/lib/analytics-data";
import type {
  FunnelCohortData,
  ValuationMultipleData,
  WinLossData,
} from "@/lib/adapters/analytics";

// Static mock data for new analytics panels (live data comes from the API).
const mockFunnelCohorts: FunnelCohortData[] = [
  { month: "Jan 2025", in_market: 4, monitor_for_exit: 9, on_hold: 2, pulled: 1 },
  { month: "Feb 2025", in_market: 6, monitor_for_exit: 7, on_hold: 3, pulled: 2 },
  { month: "Mar 2025", in_market: 8, monitor_for_exit: 11, on_hold: 1, pulled: 1 },
  { month: "Apr 2025", in_market: 5, monitor_for_exit: 8, on_hold: 4, pulled: 3 },
  { month: "May 2025", in_market: 7, monitor_for_exit: 10, on_hold: 2, pulled: 2 },
  { month: "Jun 2025", in_market: 9, monitor_for_exit: 12, on_hold: 3, pulled: 1 },
];
const mockValuationMultiples: ValuationMultipleData[] = [
  {
    sector: "Chemicals",
    sectorKey: "chemicals",
    deals: 8,
    avgMultiple: 7.2,
    medianMultiple: 6.8,
  },
  {
    sector: "Industrials",
    sectorKey: "industrials",
    deals: 5,
    avgMultiple: 9.1,
    medianMultiple: 8.5,
  },
  {
    sector: "Energy & Fuels",
    sectorKey: "energy_fuels",
    deals: 4,
    avgMultiple: 5.4,
    medianMultiple: 5.0,
  },
  {
    sector: "Pharma Inputs",
    sectorKey: "pharma_inputs",
    deals: 3,
    avgMultiple: 11.2,
    medianMultiple: 10.5,
  },
];
const mockWinLoss: WinLossData = {
  bySector: [
    { sector: "Chemicals", sectorKey: "chemicals", wins: 5, losses: 2 },
    { sector: "Industrials", sectorKey: "industrials", wins: 3, losses: 3 },
    { sector: "Energy & Fuels", sectorKey: "energy_fuels", wins: 2, losses: 1 },
  ],
  byConfidence: [
    { label: "High", wins: 8, losses: 1 },
    { label: "Medium", wins: 4, losses: 3 },
    { label: "Low", wins: 1, losses: 2 },
  ],
  totals: { wins: 13, losses: 6, winRate: 68 },
};
import { STAGE_DOT, SECTOR_SWATCH } from "@/lib/colors";
import { formatDate } from "@/lib/format";
import type { SourceType, Stage } from "@/lib/types";

export default function AnalyticsPage() {
  return (
    <Suspense fallback={null}>
      <AnalyticsInner />
    </Suspense>
  );
}

function AnalyticsInner() {
  const params = useSearchParams();
  const router = useRouter();

  const qPreset = tokenToPreset(params.get("range"));
  const qFrom = params.get("from");
  const qTo = params.get("to");
  const initial: CommittedRange | undefined = qPreset
    ? qPreset === "custom" && qFrom && qTo
      ? { preset: "custom", from: qFrom, to: qTo }
      : { preset: qPreset, from: qFrom ?? "", to: qTo ?? "" }
    : undefined;

  const [loading, setLoading] = useState(false);
  const r = useDateRange(initial, () => {
    setLoading(true);
    setTimeout(() => setLoading(false), 400);
  });

  // Live-or-mock analytics bundle (refetched when the committed range changes).
  const fallback = useMemo(
    () => ({
      velocity: mockVelocity,
      sectorStage: mockSectorStage,
      dealSplit: mockDealSplit,
      confidenceDist: mockConfidenceDist,
      exitFunnel: mockExitFunnel,
      transitionRates: mockTransitionRates,
      topSectors: mockTopSectors,
      sponsors: mockSponsors,
      sponsorHolding: mockSponsorHolding,
      calibration: mockCalibration,
      signalSources: mockSignalSources,
      recentChanges: mockRecentChanges,
      heatmap: buildHeatmap(),
      metrics: null as Record<string, string> | null,
      funnelCohorts: mockFunnelCohorts,
      valuationMultiples: mockValuationMultiples,
      winLoss: mockWinLoss,
    }),
    []
  );
  const [viz, setViz] = useState(fallback);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const d = (await api.analytics(
          `?from=${r.committed.from}&to=${r.committed.to}`
        )) as Record<string, unknown>;
        if (!active || !d) return;
        setViz({
          velocity: (d.velocity as typeof mockVelocity) ?? mockVelocity,
          sectorStage: (d.sectorStage as typeof mockSectorStage) ?? mockSectorStage,
          dealSplit: (d.dealSplit as typeof mockDealSplit) ?? mockDealSplit,
          confidenceDist:
            (d.confidenceDist as typeof mockConfidenceDist) ?? mockConfidenceDist,
          exitFunnel: (d.exitFunnel as typeof mockExitFunnel) ?? mockExitFunnel,
          transitionRates:
            (d.transitionRates as typeof mockTransitionRates) ?? mockTransitionRates,
          topSectors: (d.topSectors as typeof mockTopSectors) ?? mockTopSectors,
          sponsors: (d.sponsors as typeof mockSponsors) ?? mockSponsors,
          sponsorHolding:
            (d.sponsorHolding as typeof mockSponsorHolding) ?? mockSponsorHolding,
          calibration: (d.calibration as typeof mockCalibration) ?? mockCalibration,
          signalSources:
            (d.signalSources as typeof mockSignalSources) ?? mockSignalSources,
          recentChanges:
            (d.recentChanges as typeof mockRecentChanges) ?? mockRecentChanges,
          heatmap: (d.heatmap as ReturnType<typeof buildHeatmap>) ?? buildHeatmap(),
          metrics: (d.metrics as Record<string, string> | null) ?? null,
          funnelCohorts: (d.funnelCohorts as FunnelCohortData[]) ?? mockFunnelCohorts,
          valuationMultiples:
            (d.valuationMultiples as ValuationMultipleData[]) ?? mockValuationMultiples,
          winLoss: (d.winLoss as WinLossData) ?? mockWinLoss,
        });
      } catch {
        if (active) setViz(fallback);
      }
    })();
    return () => {
      active = false;
    };
  }, [r.committed.from, r.committed.to, fallback]);

  const {
    velocity,
    sectorStage,
    dealSplit,
    confidenceDist,
    exitFunnel,
    transitionRates,
    topSectors,
    sponsors,
    sponsorHolding,
    calibration,
    signalSources,
    recentChanges,
    heatmap,
    metrics,
    funnelCohorts,
    valuationMultiples,
    winLoss,
  } = viz;

  const onSectorClick = (d: unknown) => {
    const key = (d as { payload?: { sectorKey?: string } })?.payload?.sectorKey;
    if (key) router.push(`/radar?sector=${key}`);
  };

  return (
    <div>
      {/* sticky control bar */}
      <div
        className="sticky top-14 z-10 -mx-6 mb-5 flex flex-wrap items-center justify-between gap-3 bg-bg/90 px-6 py-3 backdrop-blur"
        style={{ borderBottom: "0.5px solid var(--border)" }}
      >
        <div className="flex items-center gap-2">
          <ChartBarIcon className="h-[18px] w-[18px] text-muted" />
          <h1 className="text-[18px] font-medium text-ink">Analytics</h1>
        </div>
        <DateRangeControl
          variant="bar"
          selected={r.selected}
          from={r.from}
          to={r.to}
          onSelect={r.selectPreset}
          onFromChange={r.setFrom}
          onToChange={r.setTo}
          onApply={r.apply}
        />
      </div>

      {/* ROW 1 — metric cards */}
      <div className="mb-4 grid grid-cols-2 gap-4 lg:grid-cols-3">
        {METRICS.map((m) => (
          <MetricCard
            key={m.id}
            m={m}
            preset={r.committed.preset}
            loading={loading}
            override={metrics?.[m.id]}
          />
        ))}
      </div>

      {/* ROW 2 — velocity */}
      <Panel title="Deal velocity — new entries per week" className="mb-4">
        {loading ? (
          <Skeleton h={300} />
        ) : (
          <>
            <Legend
              items={[
                { color: "#185FA5", label: "Carveouts" },
                { color: "#1D9E75", label: "Private assets" },
                { color: "#B4B2A9", label: "4-week rolling avg", dashed: true },
              ]}
            />
            <ResponsiveContainer width="100%" height={260}>
              <ComposedChart data={velocity} barGap={1} barCategoryGap="22%">
                <CartesianGrid vertical={false} stroke="#EFEDE6" />
                <XAxis
                  dataKey="label"
                  interval={0}
                  tick={AXIS}
                  tickLine={false}
                  axisLine={{ stroke: "#E6E4DD" }}
                />
                <YAxis
                  yAxisId="L"
                  domain={[0, 10]}
                  tick={AXIS}
                  tickLine={false}
                  axisLine={false}
                  width={22}
                />
                <YAxis
                  yAxisId="R"
                  orientation="right"
                  domain={[0, 10]}
                  tick={AXIS}
                  tickLine={false}
                  axisLine={false}
                  width={22}
                />
                <Tooltip
                  content={<VelocityTip />}
                  cursor={{ fill: "rgba(0,0,0,0.03)" }}
                />
                <Bar
                  yAxisId="L"
                  dataKey="carveout"
                  fill="#185FA5"
                  radius={[2, 2, 0, 0]}
                />
                <Bar
                  yAxisId="L"
                  dataKey="private_asset"
                  fill="#1D9E75"
                  radius={[2, 2, 0, 0]}
                />
                <Line
                  yAxisId="R"
                  type="monotone"
                  dataKey="rolling"
                  stroke="#B4B2A9"
                  strokeDasharray="4 3"
                  strokeWidth={1.5}
                  dot={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <MiniStat label="Most active week" value={velocitySummary.mostActive} />
              <MiniStat label="Quietest week" value={velocitySummary.quietest} />
              <MiniStat label="Avg per week" value={velocitySummary.avgPerWeek} />
            </div>
          </>
        )}
      </Panel>

      {/* ROW 3 — sector stack + (deal split / confidence) */}
      <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-[3fr_2fr]">
        <Panel title="Stage distribution by sector">
          {loading ? (
            <Skeleton h={300} />
          ) : (
            <>
              <Legend
                items={[
                  { color: "#185FA5", label: "In market" },
                  { color: "#BA7517", label: "Monitor for exit" },
                  { color: "#B4B2A9", label: "On hold / Pulled" },
                ]}
              />
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={sectorStage} layout="vertical" barCategoryGap="26%">
                  <CartesianGrid horizontal={false} stroke="#EFEDE6" />
                  <XAxis
                    type="number"
                    tick={AXIS}
                    tickLine={false}
                    axisLine={{ stroke: "#E6E4DD" }}
                  />
                  <YAxis
                    type="category"
                    dataKey="sector"
                    tick={AXIS}
                    tickLine={false}
                    axisLine={false}
                    width={120}
                  />
                  <Tooltip
                    content={<SectorTip />}
                    cursor={{ fill: "rgba(0,0,0,0.03)" }}
                  />
                  <Bar
                    dataKey="in_market"
                    stackId="s"
                    fill="#185FA5"
                    onClick={onSectorClick}
                  />
                  <Bar
                    dataKey="monitor"
                    stackId="s"
                    fill="#BA7517"
                    onClick={onSectorClick}
                  />
                  <Bar
                    dataKey="on_hold"
                    stackId="s"
                    fill="#B4B2A9"
                    radius={[0, 2, 2, 0]}
                    onClick={onSectorClick}
                  >
                    <LabelList
                      dataKey="total"
                      position="right"
                      style={{ fill: "#6f6e68", fontSize: 10 }}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </>
          )}
        </Panel>

        <div className="space-y-4">
          {/* deal split */}
          <Panel title="Deal type split">
            {loading ? (
              <Skeleton h={200} />
            ) : (
              <>
                <div className="relative">
                  <ResponsiveContainer width="100%" height={180}>
                    <PieChart>
                      <Pie
                        data={dealSplit.parts}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={56}
                        outerRadius={82}
                        paddingAngle={2}
                        stroke="none"
                      >
                        {dealSplit.parts.map((p) => (
                          <Cell key={p.name} fill={p.color} />
                        ))}
                      </Pie>
                      <Tooltip content={<DealTip />} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-[16px] font-medium text-ink">
                      {dealSplit.total.toLocaleString()}
                    </span>
                    <span className="text-[10px] font-normal text-subtle">total</span>
                  </div>
                </div>
                <div className="mt-2 flex justify-center gap-4">
                  {dealSplit.parts.map((p) => (
                    <span
                      key={p.name}
                      className="inline-flex items-center gap-1.5 text-[11px] font-normal text-muted"
                    >
                      <span
                        className="h-2 w-2 rounded-sm"
                        style={{ backgroundColor: p.color }}
                      />
                      {p.name} — {p.value} ({p.pct}%)
                    </span>
                  ))}
                </div>
              </>
            )}
          </Panel>

          {/* confidence distribution */}
          <Panel title="Confidence distribution">
            {loading ? (
              <Skeleton h={120} />
            ) : (
              <>
                <div className="flex h-5 w-full overflow-hidden rounded-md">
                  {confidenceDist.map((c) => (
                    <div
                      key={c.label}
                      className="flex items-center justify-center text-[10px] font-medium text-white"
                      style={{ width: `${c.pct}%`, backgroundColor: c.color }}
                      title={`${c.label}: ${c.count} (${c.pct}%)`}
                    >
                      {c.pct >= 12 ? `${c.pct}%` : ""}
                    </div>
                  ))}
                </div>
                <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5">
                  {confidenceDist.map((c) => (
                    <span key={c.label} className="flex items-center gap-1.5 text-[11px]">
                      <span
                        className="h-1.5 w-1.5 rounded-full"
                        style={{ backgroundColor: c.color }}
                      />
                      <span className="font-normal text-muted">{c.label}</span>
                      <span className="ml-auto font-medium text-ink">{c.count}</span>
                    </span>
                  ))}
                </div>
              </>
            )}
          </Panel>
        </div>
      </div>

      {/* ROW 4 — funnel / top sectors / sponsors */}
      <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* funnel + transitions */}
        <Panel title="Exit funnel — avg. days per stage">
          {loading ? (
            <Skeleton h={300} />
          ) : (
            <>
              <div className="space-y-3">
                {exitFunnel.map((f) => (
                  <div key={f.stage} className="mx-auto" style={{ width: `${f.width}%` }}>
                    <div
                      className="rounded-md px-3 py-2"
                      style={{
                        backgroundColor: f.bg,
                        borderLeft: `2px solid ${f.border}`,
                      }}
                    >
                      <div className="flex items-center justify-between text-[12px]">
                        <span className="font-medium text-ink">{f.stage}</span>
                        <span className="font-medium text-ink">{f.days}d avg</span>
                      </div>
                      <p className="text-[10px] font-normal text-subtle">
                        n={f.n} companies
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              <h4 className="mb-2 mt-5 text-[12px] font-medium text-ink">
                Stage transition rates
              </h4>
              <div className="space-y-2.5">
                {transitionRates.map((t) => (
                  <div key={t.label}>
                    <div className="mb-1 flex items-center justify-between text-[11px]">
                      <span className="font-normal text-muted">
                        {t.label}
                        {t.note && <span className="text-subtle"> ({t.note})</span>}
                      </span>
                      <span className="font-medium text-ink">{t.pct}%</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-[#F1EFE8]">
                      <div
                        className="h-1.5 rounded-full"
                        style={{ width: `${t.pct}%`, backgroundColor: "#185FA5" }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </Panel>

        {/* top sectors */}
        <Panel title="Top sectors by avg. time in market">
          {loading ? (
            <Skeleton h={300} />
          ) : (
            <>
              <div className="space-y-3">
                {topSectors.map((s) => {
                  const max = Math.max(...topSectors.map((x) => x.days));
                  return (
                    <button
                      key={s.sector}
                      type="button"
                      onClick={() => router.push(`/radar?sector=${s.sectorKey}`)}
                      className="block w-full text-left"
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-32 shrink-0 truncate text-[12px] font-normal text-muted">
                          {s.sector}
                        </span>
                        <div className="h-2 flex-1 rounded-full bg-[#F1EFE8]">
                          <div
                            className="h-2 rounded-full"
                            style={{
                              width: `${(s.days / max) * 100}%`,
                              backgroundColor: "#185FA5",
                            }}
                          />
                        </div>
                        <span className="w-9 shrink-0 text-right text-[12px] font-medium text-ink">
                          {s.days}d
                        </span>
                      </div>
                      <p className="ml-[136px] text-[10px] font-normal text-subtle">
                        n={s.n} active deals
                      </p>
                    </button>
                  );
                })}
              </div>
              <p className="mt-4 text-[11px] font-normal italic text-subtle">
                Specialty materials deals take 2x longer to close than energy sector deals
                on average.
              </p>
            </>
          )}
        </Panel>

        {/* sponsors */}
        <Panel title="Most active PE sponsors this period">
          {loading ? (
            <Skeleton h={300} />
          ) : (
            <>
              <ul className="space-y-1">
                {sponsors.map((s) => (
                  <li key={s.slug}>
                    <button
                      type="button"
                      onClick={() => router.push(`/radar?sponsor=${s.slug}`)}
                      className="flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-left hover:bg-[#F5F4EF]"
                    >
                      <span className="w-3 shrink-0 text-[11px] font-normal text-subtle">
                        {s.rank}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="text-[13px] font-medium text-ink">{s.name}</div>
                        <div className="text-[11px] font-normal text-muted">
                          {s.processes} active process{s.processes > 1 ? "es" : ""}
                        </div>
                      </div>
                      <span
                        className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium"
                        style={{
                          backgroundColor: SECTOR_SWATCH.bg,
                          color: SECTOR_SWATCH.text,
                        }}
                      >
                        {s.sector}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-[10px] font-normal italic text-subtle">
                Sponsor data derived from private asset pipeline signals. May not reflect
                all active mandates.
              </p>
            </>
          )}
        </Panel>
      </div>

      {/* ROW 4.5 — sponsor hold periods + confidence calibration */}
      <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel title="Sponsor hold periods — avg. days to market">
          {loading ? <Skeleton h={260} /> : <SponsorHoldingChart data={sponsorHolding} />}
        </Panel>
        <Panel title="Confidence calibration — close rate by band">
          {loading ? <Skeleton h={260} /> : <CalibrationChart data={calibration} />}
        </Panel>
      </div>

      {/* ROW 5 — heatmap */}
      <Panel title="Deal activity heatmap — events by day" className="mb-4">
        {loading ? <Skeleton h={180} /> : <Heatmap days={heatmap} />}
      </Panel>

      {/* ROW 6 — recent changes + signal sources */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel title="Recent stage changes">
          {loading ? (
            <Skeleton h={320} />
          ) : (
            <>
              <ul>
                {recentChanges.map((c, i) => (
                  <li
                    key={i}
                    className="flex items-center gap-2 py-2"
                    style={{ borderTop: i ? "0.5px solid var(--border)" : undefined }}
                  >
                    <span
                      className="h-[7px] w-[7px] shrink-0 rounded-full"
                      style={{ backgroundColor: STAGE_DOT[c.to as Stage] }}
                    />
                    <span className="shrink-0 text-[13px] font-medium text-ink">
                      {c.company}
                    </span>
                    <span className="flex items-center gap-1">
                      <StageBadge stage={c.from as Stage} />
                      <ArrowRightIcon className="h-3 w-3 text-subtle" />
                      <StageBadge stage={c.to as Stage} />
                    </span>
                    <span className="ml-auto flex shrink-0 items-center gap-2">
                      <SourceIcon source={c.source as SourceType} />
                      <span className="text-[11px] font-normal text-subtle">
                        {c.time}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
              <Link
                href="/feed"
                className="mt-3 inline-flex w-full items-center justify-center rounded-md px-2.5 py-1.5 text-[12px] font-medium text-ink"
                style={{ border: "0.5px solid var(--border)" }}
              >
                View full activity log
              </Link>
            </>
          )}
        </Panel>

        <Panel title="Where signals are coming from">
          {loading ? (
            <Skeleton h={320} />
          ) : (
            <>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={signalSources} barCategoryGap="28%">
                  <CartesianGrid vertical={false} stroke="#EFEDE6" />
                  <XAxis
                    dataKey="short"
                    tick={AXIS}
                    tickLine={false}
                    axisLine={{ stroke: "#E6E4DD" }}
                  />
                  <YAxis tick={AXIS} tickLine={false} axisLine={false} width={28} />
                  <Tooltip
                    content={<SignalTip />}
                    cursor={{ fill: "rgba(0,0,0,0.03)" }}
                  />
                  <Bar dataKey="count" fill="#185FA5" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
              <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                <MiniStat
                  label="Highest accuracy source"
                  value="SEC Filings — 0.94 avg confidence"
                />
                <MiniStat
                  label="Fastest signal"
                  value="PE Wire / News — avg 4h to detection"
                />
              </div>
            </>
          )}
        </Panel>
      </div>

      {/* ROW 7 — conversion funnel cohorts */}
      <Panel title="Stage entry by month — pipeline cohort flow" className="mb-4">
        {loading ? (
          <Skeleton h={260} />
        ) : (
          <>
            <Legend
              items={[
                { color: "#185FA5", label: "In market" },
                { color: "#BA7517", label: "Monitor for exit" },
                { color: "#B4B2A9", label: "On hold" },
                { color: "#E24B4A", label: "Pulled" },
              ]}
            />
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={funnelCohorts} barCategoryGap="26%">
                <CartesianGrid vertical={false} stroke="#EFEDE6" />
                <XAxis
                  dataKey="month"
                  tick={AXIS}
                  tickLine={false}
                  axisLine={{ stroke: "#E6E4DD" }}
                />
                <YAxis tick={AXIS} tickLine={false} axisLine={false} width={24} />
                <Tooltip cursor={{ fill: "rgba(0,0,0,0.03)" }} />
                <Bar dataKey="in_market" name="In market" stackId="a" fill="#185FA5" />
                <Bar
                  dataKey="monitor_for_exit"
                  name="Monitor"
                  stackId="a"
                  fill="#BA7517"
                />
                <Bar dataKey="on_hold" name="On hold" stackId="a" fill="#B4B2A9" />
                <Bar
                  dataKey="pulled"
                  name="Pulled"
                  stackId="a"
                  fill="#E24B4A"
                  radius={[2, 2, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
            <p className="mt-2 text-[11px] font-normal italic text-subtle">
              Shows how many companies entered each stage per calendar month over the last
              12 months.
            </p>
          </>
        )}
      </Panel>

      {/* ROW 8 — valuation multiples + win/loss */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel title="Exit multiples by sector — closed deals">
          {loading ? (
            <Skeleton h={260} />
          ) : valuationMultiples.length === 0 ? (
            <p className="text-[12px] text-muted">
              No closed deals with recorded multiples yet.
            </p>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart
                  data={valuationMultiples}
                  layout="vertical"
                  barCategoryGap="30%"
                >
                  <CartesianGrid horizontal={false} stroke="#EFEDE6" />
                  <XAxis
                    type="number"
                    tick={AXIS}
                    tickLine={false}
                    axisLine={{ stroke: "#E6E4DD" }}
                    tickFormatter={(v) => `${v}x`}
                  />
                  <YAxis
                    type="category"
                    dataKey="sector"
                    tick={AXIS}
                    tickLine={false}
                    axisLine={false}
                    width={110}
                  />
                  <Tooltip
                    formatter={(v, name) => [
                      `${v}x`,
                      name === "avgMultiple" ? "Avg multiple" : "Median multiple",
                    ]}
                    cursor={{ fill: "rgba(0,0,0,0.03)" }}
                  />
                  <Bar
                    dataKey="medianMultiple"
                    name="Median"
                    fill="#185FA5"
                    radius={[0, 2, 2, 0]}
                  >
                    <LabelList
                      dataKey="medianMultiple"
                      position="right"
                      formatter={(v: unknown) => (v != null ? `${v}x` : "")}
                      style={{ fill: "#6f6e68", fontSize: 10 }}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <p className="mt-2 text-[11px] font-normal italic text-subtle">
                Median EBITDA multiple at close. n = deals per sector with recorded
                multiples.
              </p>
            </>
          )}
        </Panel>

        <Panel title="Win/loss outcomes by confidence band">
          {loading ? (
            <Skeleton h={260} />
          ) : winLoss.totals.wins + winLoss.totals.losses === 0 ? (
            <p className="text-[12px] text-muted">No resolved deals yet.</p>
          ) : (
            <>
              {/* top-line rate */}
              <div className="mb-4 flex items-center gap-4">
                <div className="rounded-lg bg-[#F0FBF6] px-4 py-3 text-center">
                  <p className="text-[24px] font-semibold text-[#157A5A]">
                    {winLoss.totals.winRate}%
                  </p>
                  <p className="text-[11px] text-[#157A5A]">close rate</p>
                </div>
                <div className="text-[12px] text-muted">
                  <p>
                    <span className="font-medium text-ink">{winLoss.totals.wins}</span>{" "}
                    closed
                  </p>
                  <p>
                    <span className="font-medium text-ink">{winLoss.totals.losses}</span>{" "}
                    withdrawn
                  </p>
                </div>
              </div>
              {/* by confidence */}
              <p className="mb-2 text-[11px] font-medium uppercase tracking-widest text-muted">
                By confidence band
              </p>
              <div className="space-y-2">
                {winLoss.byConfidence.map((c) => {
                  const total = c.wins + c.losses;
                  const winPct = total === 0 ? 0 : Math.round((c.wins / total) * 100);
                  return (
                    <div key={c.label}>
                      <div className="mb-1 flex items-center justify-between text-[11px]">
                        <span className="font-normal text-muted">{c.label}</span>
                        <span className="font-medium text-ink">
                          {c.wins}/{total} ({winPct}%)
                        </span>
                      </div>
                      <div className="flex h-2 overflow-hidden rounded-full bg-[#FCEBEB]">
                        <div
                          className="h-full rounded-full bg-[#157A5A]"
                          style={{ width: `${winPct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </Panel>
      </div>
    </div>
  );
}

// =================== sub-components ===================

const AXIS = { fontSize: 10, fill: "#9a9890", fontWeight: 400 } as const;

function Panel({
  title,
  children,
  className = "",
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-lg bg-surface p-4 ${className}`}
      style={{ border: "0.5px solid var(--border)" }}
    >
      <h2 className="mb-3 text-[13px] font-medium text-ink">{title}</h2>
      {children}
    </section>
  );
}

function Skeleton({ h }: { h: number }) {
  return (
    <div className="w-full animate-pulse rounded-md bg-[#EFEDE6]" style={{ height: h }} />
  );
}

function Legend({
  items,
}: {
  items: { color: string; label: string; dashed?: boolean }[];
}) {
  return (
    <div className="mb-2 flex flex-wrap items-center gap-4">
      {items.map((it) => (
        <span
          key={it.label}
          className="inline-flex items-center gap-1.5 text-[11px] font-normal text-muted"
        >
          {it.dashed ? (
            <span
              className="inline-block h-0 w-4 border-t-2 border-dashed"
              style={{ borderColor: it.color }}
            />
          ) : (
            <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: it.color }} />
          )}
          {it.label}
        </span>
      ))}
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-[#F5F4EF] px-3 py-2">
      <div className="text-[10px] font-normal text-subtle">{label}</div>
      <div className="text-[12px] font-medium text-ink">{value}</div>
    </div>
  );
}

function MetricCard({
  m,
  preset,
  loading,
  override,
}: {
  m: MetricSpec;
  preset: CommittedRange["preset"];
  loading: boolean;
  override?: string;
}) {
  const value = metricValue(m, preset);
  const display = override ?? m.display(value);
  // Darker amber so the delta text clears WCAG AA on the #F5F4EF card.
  const tone = m.deltaTone === "good" ? "#27500A" : "#8A5712";
  return (
    <div className="rounded-lg bg-[#F5F4EF] p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-[11px] font-normal text-muted">{m.label}</div>
          <div className="mt-1 text-[20px] font-medium leading-tight text-ink">
            {loading ? "—" : display}
          </div>
        </div>
        {!loading && <Sparkline values={m.spark} tone={m.deltaTone} />}
      </div>
      {!loading && (
        <div
          className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium"
          style={{ color: tone }}
        >
          {m.deltaDir === "up" ? (
            <ArrowUpIcon className="h-3 w-3" />
          ) : (
            <ArrowDownIcon className="h-3 w-3" />
          )}
          {m.delta}
        </div>
      )}
    </div>
  );
}

function Sparkline({ values, tone }: { values: number[]; tone: "good" | "neutral" }) {
  const w = 64;
  const h = 24;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * w;
    const y = h - ((v - min) / span) * h;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const color = tone === "good" ? "#1D9E75" : "#BA7517";
  return (
    <svg width={w} height={h} className="shrink-0">
      <polyline
        points={pts.join(" ")}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const SOURCE_ICON: Record<SourceType, typeof DocumentIcon> = {
  sec_filing: DocumentIcon,
  earnings_transcript: MicIcon,
  google_news: GlobeIcon,
  rss_feed: RssIcon,
  manual: PencilIcon,
};
function SourceIcon({ source }: { source: SourceType }) {
  const Icon = SOURCE_ICON[source];
  return <Icon className="h-3.5 w-3.5 text-subtle" />;
}

// ---- chart tooltips ----
interface TipProps {
  active?: boolean;
  payload?: { payload: Record<string, number | string> }[];
}

function tipBox(rows: [string, string][]) {
  return (
    <div
      className="rounded-md bg-surface px-2.5 py-2 text-[11px]"
      style={{ border: "0.5px solid var(--border)" }}
    >
      {rows.map(([k, v], i) => (
        <div key={i} className="flex justify-between gap-3">
          <span className="text-muted">{k}</span>
          <span className="font-medium text-ink">{v}</span>
        </div>
      ))}
    </div>
  );
}

function VelocityTip({ active, payload }: TipProps) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return tipBox([
    ["Week", `${Number(d.i) + 1}`],
    ["Carveouts", `${d.carveout}`],
    ["Private assets", `${d.private_asset}`],
    ["Total", `${d.total}`],
    ["Rolling avg", `${d.rolling}`],
  ]);
}

function SectorTip({ active, payload }: TipProps) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return tipBox([
    ["Sector", `${d.sector}`],
    ["In market", `${d.in_market}`],
    ["Monitor", `${d.monitor}`],
    ["On hold / Pulled", `${d.on_hold}`],
    ["Total", `${d.total}`],
  ]);
}

function DealTip({ active, payload }: TipProps) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  const pct = Math.round((Number(d.value) / 1084) * 100);
  return tipBox([
    ["Type", `${d.name}`],
    ["Count", `${d.value}`],
    ["Share", `${pct}%`],
  ]);
}

function SignalTip({ active, payload }: TipProps) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return tipBox([
    ["Source", `${d.name}`],
    ["Signals", `${d.count}`],
    ["Share", `${d.pct}%`],
  ]);
}

// ---- sponsor hold periods ----
function SponsorHoldingChart({ data }: { data: SponsorHoldingPoint[] }) {
  const maxDays = Math.max(...data.map((d) => d.avgDaysHold ?? 0), 1);
  return (
    <div className="space-y-3">
      {data.map((d) => (
        <div key={d.slug}>
          <div className="flex items-center justify-between text-[12px]">
            <span className="truncate font-normal text-muted" style={{ maxWidth: 140 }}>
              {d.sponsor}
            </span>
            <div className="flex items-center gap-2">
              <span
                className="rounded-full px-1.5 py-0.5 text-[10px] font-medium"
                style={{ backgroundColor: "#E6F1FB", color: "#185FA5" }}
                title="Exit rate — share of tracked deals reaching in_market"
              >
                {d.exitRatePct}% exit
              </span>
              <span className="w-12 text-right font-medium text-ink">
                {d.avgDaysHold != null ? `${d.avgDaysHold}d` : "—"}
              </span>
            </div>
          </div>
          <div className="mt-1 h-1.5 w-full rounded-full bg-[#F1EFE8]">
            <div
              className="h-1.5 rounded-full bg-[#185FA5]"
              style={{
                width: `${Math.round(((d.avgDaysHold ?? 0) / maxDays) * 100)}%`,
              }}
            />
          </div>
          <p className="text-[10px] font-normal text-subtle">
            {d.totalDeals} deals tracked · {d.marketCount} reached market
          </p>
        </div>
      ))}
      {data.length === 0 && (
        <p className="text-[13px] text-subtle">No sponsor data in this range.</p>
      )}
    </div>
  );
}

// ---- confidence calibration ----
function CalibrationChart({ data }: { data: ConfidenceCalibrationPoint[] }) {
  return (
    <div className="space-y-4">
      {data.map((d) => (
        <div key={d.confidence}>
          <div className="mb-1 flex items-center justify-between text-[12px]">
            <span className="flex items-center gap-1.5 font-normal text-muted">
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: d.color }}
              />
              {d.label}
            </span>
            <span className="font-medium text-ink">{d.closeRatePct}% close rate</span>
          </div>
          <div className="h-2 w-full rounded-full bg-[#F1EFE8]">
            <div
              className="h-2 rounded-full"
              style={{ width: `${d.closeRatePct}%`, backgroundColor: d.color }}
            />
          </div>
          <p className="mt-0.5 text-[10px] font-normal text-subtle">
            {d.closedCount} closed · {d.lostCount} lost · {d.total} total
          </p>
        </div>
      ))}
      <p className="mt-2 text-[11px] font-normal italic text-subtle">
        Computed over resolved deals only (closed + withdrawn + pulled).
      </p>
    </div>
  );
}

// ---- heatmap ----
function Heatmap({ days }: { days: ReturnType<typeof buildHeatmap> }) {
  const firstDow = days[0]?.dow ?? 0;
  // arrange into columns (weeks) x 7 rows (Mon..Sun)
  const columns: ((typeof days)[number] | null)[][] = [];
  days.forEach((day, idx) => {
    const slot = idx + firstDow;
    const col = Math.floor(slot / 7);
    if (!columns[col]) columns[col] = Array(7).fill(null);
    columns[col][day.dow] = day;
  });

  const monthLabel = (col: ((typeof days)[number] | null)[]): string => {
    const first = col.find(Boolean);
    if (!first) return "";
    const d = new Date(first.date + "T12:00:00");
    return d.getDate() <= 7 ? d.toLocaleDateString("en-US", { month: "short" }) : "";
  };

  const dayLabels = ["M", "", "W", "", "F", "", ""];

  return (
    <div>
      <div className="flex gap-2 overflow-x-auto">
        {/* day labels */}
        <div className="flex flex-col gap-[2px] pt-[18px]">
          {dayLabels.map((l, i) => (
            <span key={i} className="h-3 text-[8px] leading-3 text-subtle">
              {l}
            </span>
          ))}
        </div>
        <div>
          {/* month labels */}
          <div className="flex gap-[2px]">
            {columns.map((col, i) => (
              <span key={i} className="w-3 text-[8px] text-subtle">
                {monthLabel(col)}
              </span>
            ))}
          </div>
          {/* grid */}
          <div className="flex gap-[2px]">
            {columns.map((col, ci) => (
              <div key={ci} className="flex flex-col gap-[2px]">
                {col.map((day, ri) =>
                  day ? (
                    <Link
                      key={ri}
                      href={`/feed?from=${day.date}&to=${day.date}`}
                      className="h-3 w-3 rounded-[2px]"
                      style={{ backgroundColor: heatColor(day.count) }}
                      title={`${formatDate(day.date)} — ${day.count} events (${day.stageChanges} stage changes, ${day.newEntries} new entries)`}
                    />
                  ) : (
                    <span key={ri} className="h-3 w-3" />
                  )
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* scale legend */}
      <div className="mt-3 flex items-center gap-1.5">
        <span className="text-[10px] text-subtle">0</span>
        {["#F1EFE8", "#B5D4F4", "#5DA8EF", "#185FA5", "#0C447C"].map((c) => (
          <span
            key={c}
            className="h-3 w-3 rounded-[2px]"
            style={{ backgroundColor: c }}
          />
        ))}
        <span className="text-[10px] text-subtle">7+</span>
        <span className="ml-1 inline-flex items-center gap-1 text-[10px] text-subtle">
          More activity <ArrowRightIcon className="h-3 w-3" />
        </span>
      </div>
    </div>
  );
}
