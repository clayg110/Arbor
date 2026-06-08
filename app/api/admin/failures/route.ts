import { type NextRequest } from "next/server";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/server";
import { ok, fail, requireBackend, serverError } from "@/lib/api/respond";
import { requireAdmin } from "@/lib/api/auth";
import { auditAs } from "@/lib/audit";
import { parseJson } from "@/lib/validation";
import { processItem } from "@/lib/ingest/pipeline";
import { CircuitBreaker } from "@/lib/circuit";
import type { SignalMeta } from "@/lib/ingest/persist";
import type { DbSignalFailure } from "@/types/db";
import type { SourceType } from "@/lib/types";

const CARVEOUT_SOURCES = new Set(["sec_filing", "earnings_transcript"]);
function dealTypeFor(sourceType: string | null): "carveout" | "private_asset" {
  return CARVEOUT_SOURCES.has(sourceType ?? "") ? "carveout" : "private_asset";
}

// GET /api/admin/failures?limit= — recent dead-lettered signals (admin only).
export async function GET(request: NextRequest) {
  const guard = requireBackend();
  if (guard) return guard;
  const gate = await requireAdmin();
  if (gate.res) return gate.res;

  const limit = Math.min(Number(request.nextUrl.searchParams.get("limit") ?? 100), 500);
  const svc = createServiceClient();
  const { data, error } = await svc
    .from("signal_failures")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) return serverError(error);

  const failures = ((data ?? []) as DbSignalFailure[]).map((f) => ({
    id: f.id,
    sourceType: f.source_type,
    sourceName: f.source_name,
    sourceUrl: f.source_url,
    reason: f.reason,
    excerpt: (f.raw_text ?? "").slice(0, 200),
    createdAt: f.created_at,
  }));
  return ok({ failures });
}

// POST /api/admin/failures — { id } re-run a dead-lettered signal. On success the
// row is removed; if it fails again it stays for another attempt.
export async function POST(request: NextRequest) {
  const guard = requireBackend();
  if (guard) return guard;
  const gate = await requireAdmin();
  if (gate.res) return gate.res;

  const parsed = await parseJson(request, z.object({ id: z.string().min(1) }));
  if (!parsed.ok) return parsed.res;

  const svc = createServiceClient();
  const { data, error } = await svc
    .from("signal_failures")
    .select("*")
    .eq("id", parsed.data.id)
    .maybeSingle();
  if (error) return serverError(error);
  const row = data as DbSignalFailure | null;
  if (!row) return fail("Failure not found", 404);

  const meta: SignalMeta = {
    sourceType: (row.source_type ?? "manual") as SourceType,
    sourceName: row.source_name ?? "Replay",
    docType: row.doc_type ?? "",
    sourceUrl: row.source_url ?? "",
    rawText: row.raw_text ?? "",
  };

  const counts: Record<string, number> = {};
  await processItem(
    svc,
    meta,
    dealTypeFor(row.source_type),
    counts,
    new CircuitBreaker()
  );
  const replayed = !counts.errors;

  if (replayed) {
    await svc.from("signal_failures").delete().eq("id", row.id);
  }
  await auditAs(gate.user, "signal.replay", {
    entityType: "signal_failure",
    entityId: row.id,
    metadata: { replayed, counts },
  });

  return ok({ ok: replayed, counts });
}

// DELETE /api/admin/failures?id= — discard a dead-lettered signal.
export async function DELETE(request: NextRequest) {
  const guard = requireBackend();
  if (guard) return guard;
  const gate = await requireAdmin();
  if (gate.res) return gate.res;

  const id = request.nextUrl.searchParams.get("id");
  if (!id) return fail("id required");

  const svc = createServiceClient();
  const { error } = await svc.from("signal_failures").delete().eq("id", id);
  if (error) return serverError(error);

  await auditAs(gate.user, "signal.dismiss", {
    entityType: "signal_failure",
    entityId: id,
  });
  return ok({ ok: true, id });
}
