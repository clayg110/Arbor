import { type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ok, fail, requireBackend } from "@/lib/api/respond";
import {
  toVelocity,
  toSectorStage,
  toDealSplit,
  toConfidenceDist,
  toExitFunnel,
  toTopSectors,
  toSponsors,
  toSignalSources,
  toHeatmap,
  toTransitionRates,
  toSummaryStrip,
  toSectorSummary,
  toMetricValues,
  toRangeStats,
  toRecentChanges,
} from "@/lib/adapters";
import type {
  VelocityRow,
  HeatmapRow,
  SectorStageRow,
  DealSplitRow,
  ConfidenceDistRow,
  ExitFunnelRow,
  TopSectorRow,
  SponsorActivityRow,
  SignalSourceRow,
  TransitionRateRow,
  SummaryCountsRow,
  SummaryMetricsRow,
  EventCountsRow,
  RecentChangeRow,
} from "@/types/db";

// GET /api/analytics?from&to — full analytics payload (range-aware).
export async function GET(request: NextRequest) {
  const guard = requireBackend();
  if (guard) return guard;

  const sp = request.nextUrl.searchParams;
  const from = sp.get("from");
  const to = sp.get("to");
  const range = from && to ? { p_from: from, p_to: to } : {};

  const supabase = createClient();

  const [
    velocity,
    sectorStage,
    dealSplit,
    confidenceDist,
    exitFunnel,
    topSectors,
    sponsors,
    signalSources,
    transitionRates,
    summary,
    metrics,
    eventCounts,
    heatmap,
    recent,
  ] = await Promise.all([
    supabase.rpc("rpc_velocity", range),
    supabase.from("v_sector_stage").select("*"),
    supabase.from("v_deal_split").select("*"),
    supabase.from("v_confidence_dist").select("*"),
    supabase.from("v_exit_funnel").select("*"),
    supabase.from("v_top_sectors").select("*"),
    supabase.from("v_sponsor_activity").select("*"),
    supabase.from("v_signal_sources").select("*"),
    supabase.from("v_transition_rates").select("*"),
    supabase.from("v_summary_counts").select("*").limit(1),
    supabase.rpc("rpc_summary_metrics", range),
    supabase.rpc("rpc_event_counts", range),
    supabase.rpc("rpc_heatmap", {}), // heatmap fixed at 90 days
    supabase.from("v_recent_changes").select("*").limit(8),
  ]);

  const firstError =
    velocity.error || sectorStage.error || dealSplit.error || metrics.error || heatmap.error;
  if (firstError) return fail(firstError.message, 500);

  const sectorRows = (sectorStage.data ?? []) as SectorStageRow[];
  const summaryRow = (summary.data?.[0] as SummaryCountsRow | undefined) ?? null;
  const metricsRow = (metrics.data?.[0] as SummaryMetricsRow | undefined) ?? null;
  const eventRow = (eventCounts.data?.[0] as EventCountsRow | undefined) ?? null;

  return ok({
    velocity: toVelocity((velocity.data ?? []) as VelocityRow[]),
    sectorStage: toSectorStage(sectorRows),
    dealSplit: toDealSplit((dealSplit.data ?? []) as DealSplitRow[]),
    confidenceDist: toConfidenceDist((confidenceDist.data ?? []) as ConfidenceDistRow[]),
    exitFunnel: toExitFunnel((exitFunnel.data ?? []) as ExitFunnelRow[]),
    topSectors: toTopSectors((topSectors.data ?? []) as TopSectorRow[]),
    sponsors: toSponsors((sponsors.data ?? []) as SponsorActivityRow[]),
    signalSources: toSignalSources((signalSources.data ?? []) as SignalSourceRow[]),
    transitionRates: toTransitionRates((transitionRates.data ?? []) as TransitionRateRow[]),
    heatmap: toHeatmap((heatmap.data ?? []) as HeatmapRow[]),
    recentChanges: toRecentChanges((recent.data ?? []) as RecentChangeRow[]),
    summary: summaryRow ? toSummaryStrip(summaryRow) : null,
    sectorSummary: toSectorSummary(sectorRows),
    metrics: metricsRow ? toMetricValues(metricsRow) : null,
    rangeStats: eventRow ? toRangeStats(eventRow) : null,
  });
}
