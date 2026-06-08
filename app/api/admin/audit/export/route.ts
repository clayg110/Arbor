import { type NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { requireBackend, serverError } from "@/lib/api/respond";
import { requireAdmin } from "@/lib/api/auth";
import { toCsv, type CsvColumn } from "@/lib/csv";
import type { DbAuditLog } from "@/types/db";

export const dynamic = "force-dynamic";

const COLUMNS: CsvColumn<DbAuditLog>[] = [
  { header: "id", value: (a) => a.id },
  { header: "created_at", value: (a) => a.created_at },
  { header: "action", value: (a) => a.action },
  { header: "entity_type", value: (a) => a.entity_type },
  { header: "entity_id", value: (a) => a.entity_id },
  { header: "actor_email", value: (a) => a.actor_email },
  { header: "user_id", value: (a) => a.user_id },
  { header: "org_id", value: (a) => a.org_id },
  { header: "metadata", value: (a) => a.metadata },
];

// GET /api/admin/audit/export?limit= — full audit trail for the admin's org as a
// downloadable CSV. Admin-gated, org-scoped, and bounded (default 5k, max 50k
// rows) so a single export can't exhaust memory. A UTF-8 BOM is prepended so
// Excel reads non-ASCII correctly.
export async function GET(request: NextRequest) {
  const guard = requireBackend();
  if (guard) return guard;
  const gate = await requireAdmin();
  if (gate.res) return gate.res;

  const limit = Math.min(
    Math.max(Number(request.nextUrl.searchParams.get("limit") ?? 5000) || 5000, 1),
    50000
  );

  const svc = createServiceClient();
  let query = svc
    .from("audit_log")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (gate.user.orgId) query = query.eq("org_id", gate.user.orgId);

  const { data, error } = await query;
  if (error) return serverError(error);

  const csv = toCsv((data ?? []) as DbAuditLog[], COLUMNS);
  const date = new Date().toISOString().slice(0, 10);
  const BOM = String.fromCharCode(0xfeff);
  return new Response(BOM + csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="arbor-audit-${date}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
