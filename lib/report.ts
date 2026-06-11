// Scheduled pipeline report: builds a styled HTML email summarising the
// current radar state. CSV attachment is handled separately via /api/radar/export.
// Dormant without RESEND_API_KEY (sendEmail is a no-op).

import { radarToCsv } from "@/lib/radar-csv";
import type { RadarCompany } from "@/lib/radar-data";

export type ReportFrequency = "off" | "weekly" | "monthly";

export interface ReportEmailPayload {
  subject: string;
  html: string;
  csvData: string;
  csvFilename: string;
}

export function buildReportCsv(companies: RadarCompany[]): string {
  return radarToCsv(companies);
}

export function buildReportEmail(
  companies: RadarCompany[],
  appUrl: string,
  frequency: ReportFrequency
): ReportEmailPayload {
  const dateStr = new Date().toISOString().slice(0, 10);
  const label = frequency === "monthly" ? "monthly" : "weekly";
  const subject = `Arbor ${label} pipeline report — ${dateStr}`;

  const inMarket = companies.filter((c) => c.stage === "in_market").length;
  const monitor = companies.filter((c) => c.stage === "monitor_for_exit").length;
  const onHold = companies.filter((c) => c.stage === "on_hold").length;
  const total = companies.length;

  const html = `<!DOCTYPE html>
<html lang="en">
<body style="font-family:sans-serif;font-size:14px;color:#2b2a26;max-width:600px;margin:40px auto;padding:0 20px">
  <h1 style="font-size:20px;font-weight:600;margin-bottom:4px">Arbor pipeline report</h1>
  <p style="color:#6a6963;font-size:12px;margin-top:0;margin-bottom:24px">${dateStr} · ${label} snapshot</p>
  <table style="width:100%;border-collapse:separate;border-spacing:8px 0">
    <tr>
      <td style="padding:12px 16px;background:#EBF4FF;border-radius:8px;text-align:center">
        <div style="font-size:24px;font-weight:700;color:#0C447C">${inMarket}</div>
        <div style="font-size:11px;color:#185FA5;margin-top:2px">In market</div>
      </td>
      <td style="padding:12px 16px;background:#FAEEDA;border-radius:8px;text-align:center">
        <div style="font-size:24px;font-weight:700;color:#7A4A00">${monitor}</div>
        <div style="font-size:11px;color:#BA7517;margin-top:2px">Monitor</div>
      </td>
      <td style="padding:12px 16px;background:#F3F2ED;border-radius:8px;text-align:center">
        <div style="font-size:24px;font-weight:700;color:#555550">${onHold}</div>
        <div style="font-size:11px;color:#6a6963;margin-top:2px">On hold</div>
      </td>
      <td style="padding:12px 16px;background:#F3F2ED;border-radius:8px;text-align:center">
        <div style="font-size:24px;font-weight:700;color:#2b2a26">${total}</div>
        <div style="font-size:11px;color:#6a6963;margin-top:2px">Total tracked</div>
      </td>
    </tr>
  </table>
  <p style="color:#6a6963;font-size:12px;margin-top:24px">
    Full pipeline CSV is attached.
    <a href="${appUrl}/radar" style="color:#185FA5">Open Arbor →</a>
  </p>
  <hr style="border:none;border-top:1px solid #E8E6DE;margin:24px 0">
  <p style="color:#9a968e;font-size:11px">
    You receive this because you enabled scheduled reports in Arbor.
    <a href="${appUrl}/settings" style="color:#185FA5">Manage preferences</a>
  </p>
</body>
</html>`;

  return {
    subject,
    html,
    csvData: buildReportCsv(companies),
    csvFilename: `arbor-radar-${dateStr}.csv`,
  };
}
