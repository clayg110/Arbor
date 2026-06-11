import type { RadarCompany } from "@/lib/radar-data";
import { toCsv, type CsvColumn } from "@/lib/csv";

const STAGE_LABEL: Record<string, string> = {
  in_market: "In Market",
  monitor_for_exit: "Monitor for Exit",
  on_hold: "On Hold",
  pulled: "Pulled",
};

export const RADAR_CSV_COLUMNS: CsvColumn<RadarCompany>[] = [
  { header: "Company", value: (r) => r.name },
  {
    header: "Deal Type",
    value: (r) => (r.dealType === "carveout" ? "Carveout" : "Private Asset"),
  },
  { header: "Sector", value: (r) => r.sector },
  { header: "Sponsor / Parent", value: (r) => r.ownerName },
  { header: "Stage", value: (r) => STAGE_LABEL[r.stage] ?? r.stage },
  { header: "Confidence", value: (r) => r.confidence },
  { header: "Days in Stage", value: (r) => r.days },
  { header: "Conviction Score", value: (r) => r.conviction?.score ?? "" },
  { header: "Last Signal", value: (r) => r.lastSignal.label },
  { header: "Revenue", value: (r) => r.revenue ?? "" },
  { header: "EBITDA", value: (r) => r.ebitda ?? "" },
  { header: "Added", value: (r) => r.addedDisplay },
];

export function radarToCsv(companies: readonly RadarCompany[]): string {
  return toCsv(companies, RADAR_CSV_COLUMNS);
}
