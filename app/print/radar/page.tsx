import { createClient } from "@/lib/supabase/server";
import { hasSupabaseEnv } from "@/lib/supabase/server";
import { toRadarCompany } from "@/lib/adapters";
import { radarCompanies } from "@/lib/radar-data";
import type { DbCompany, LastSignalRow, ConvictionRow } from "@/types/db";
import type { Sector, DealType, Stage, Confidence } from "@/lib/types";
import PrintTrigger from "./PrintTrigger";

const STAGE_LABEL: Record<string, string> = {
  in_market: "In Market",
  monitor_for_exit: "Monitor",
  on_hold: "On Hold",
  pulled: "Pulled",
};

const CONF_BADGE: Record<string, string> = {
  high: "#1A4F2A",
  medium: "#4A6A1A",
  low: "#7A5A0A",
  needs_review: "#7A1A1A",
};

export default async function PrintRadarPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const get = (k: string) => {
    const v = sp[k];
    return typeof v === "string" ? v : undefined;
  };

  let rows = radarCompanies;

  if (hasSupabaseEnv()) {
    const supabase = await createClient();
    let query = supabase.from("companies").select("*");

    const sector = get("sector");
    const deal = get("deal");
    const stages = get("stage")?.split(",").filter(Boolean);
    const confidence = get("confidence")?.split(",").filter(Boolean);
    const sponsor = get("sponsor");
    const q = get("q")?.trim();

    if (sector && sector !== "all") query = query.eq("sector", sector as Sector);
    if (deal && deal !== "all") query = query.eq("deal_type", deal as DealType);
    if (confidence?.length) query = query.in("confidence", confidence as Confidence[]);
    if (stages?.length) query = query.in("current_stage", stages as Stage[]);
    if (sponsor && sponsor !== "all")
      query = query.or(`sponsor_firm.eq.${sponsor},parent_company.eq.${sponsor}`);
    if (q)
      query = query.or(
        `name.ilike.%${q}%,sponsor_firm.ilike.%${q}%,parent_company.ilike.%${q}%`
      );

    const { data } = await query.order("name").limit(5000);
    const companies = (data ?? []) as DbCompany[];
    const ids = companies.map((c) => c.id);

    const [{ data: sigs }, { data: convRows }] = await Promise.all([
      supabase.from("v_company_last_signal").select("*").in("company_id", ids),
      supabase.from("v_company_conviction").select("*").in("company_id", ids),
    ]);
    const lastByCompany = new Map<string, LastSignalRow>();
    for (const s of (sigs ?? []) as LastSignalRow[]) lastByCompany.set(s.company_id, s);
    const convByCompany = new Map<string, ConvictionRow>();
    for (const r of (convRows ?? []) as ConvictionRow[])
      convByCompany.set(r.company_id, r);

    rows = companies.map((c) => {
      const cv = convByCompany.get(c.id);
      return toRadarCompany(
        c,
        lastByCompany.get(c.id) ?? null,
        false,
        cv
          ? {
              signalCount30d: cv.signal_count_30d,
              distinctSourceTypes: cv.distinct_source_types,
            }
          : null
      );
    });
  }

  const now = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white; }
          table { page-break-inside: auto; }
          tr { page-break-inside: avoid; }
        }
        body { font-family: system-ui, sans-serif; font-size: 12px; color: #111; }
        table { border-collapse: collapse; width: 100%; }
        th { background: #f5f4ef; text-align: left; padding: 6px 10px; font-size: 11px; font-weight: 600; border-bottom: 1px solid #ddd; }
        td { padding: 5px 10px; border-bottom: 0.5px solid #e8e8e3; vertical-align: top; }
        tr:hover td { background: #fafaf8; }
      `}</style>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "24px 20px" }}>
        <div
          className="no-print"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 16,
          }}
        >
          <h1 style={{ fontSize: 18, fontWeight: 600 }}>Radar — Print View</h1>
          <div style={{ display: "flex", gap: 8 }}>
            <a
              href="/radar"
              style={{
                padding: "6px 14px",
                border: "0.5px solid #ccc",
                borderRadius: 6,
                fontSize: 12,
                textDecoration: "none",
                color: "#333",
              }}
            >
              Back to Radar
            </a>
            <PrintTrigger />
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <p style={{ fontSize: 11, color: "#666" }}>
            Generated {now} · {rows.length} companies
          </p>
        </div>

        <table>
          <thead>
            <tr>
              <th>Company</th>
              <th>Sector</th>
              <th>Deal Type</th>
              <th>Sponsor / Parent</th>
              <th>Stage</th>
              <th>Confidence</th>
              <th>Days</th>
              <th>Conviction</th>
              <th>Revenue</th>
              <th>EBITDA</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id}>
                <td style={{ fontWeight: 500 }}>{c.name}</td>
                <td>{c.sector}</td>
                <td>{c.dealType === "carveout" ? "Carveout" : "Private"}</td>
                <td style={{ color: "#555" }}>{c.ownerName}</td>
                <td>{STAGE_LABEL[c.stage] ?? c.stage}</td>
                <td>
                  <span
                    style={{
                      display: "inline-block",
                      padding: "1px 6px",
                      borderRadius: 3,
                      fontSize: 10,
                      fontWeight: 600,
                      color: "white",
                      backgroundColor: CONF_BADGE[c.confidence] ?? "#555",
                    }}
                  >
                    {c.confidence}
                  </span>
                </td>
                <td style={{ textAlign: "right" }}>{c.days}</td>
                <td style={{ textAlign: "right" }}>
                  {c.conviction ? `${c.conviction.score}` : "—"}
                </td>
                <td style={{ color: "#555" }}>{c.revenue ?? "—"}</td>
                <td style={{ color: "#555" }}>{c.ebitda ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {rows.length === 0 && (
          <p style={{ textAlign: "center", padding: 32, color: "#888" }}>
            No companies match the current filters.
          </p>
        )}
      </div>
    </>
  );
}
