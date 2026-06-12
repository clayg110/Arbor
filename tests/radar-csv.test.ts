import { describe, it, expect } from "vitest";
import { radarToCsv, RADAR_CSV_COLUMNS } from "@/lib/radar-csv";
import type { RadarCompany } from "@/lib/radar-data";

const base: RadarCompany = {
  id: "r1",
  name: "Dow Polyurethanes",
  dealType: "carveout",
  sector: "chemicals",
  confidence: "high",
  stage: "in_market",
  ownerName: "Dow Inc.",
  days: 47,
  added: "2026-03-15",
  addedDisplay: "Mar 15 2026",
  lastSignal: {
    label: "2 days ago",
    sourceName: "SEC 8-K",
    source: "sec_filing",
    daysAgo: 2,
  },
  revenue: "$800M",
  ebitda: "$120M",
  conviction: { score: 82, band: "hot" },
};

describe("radarToCsv", () => {
  it("produces header + data row", () => {
    const out = radarToCsv([base]);
    const lines = out.split("\r\n");
    expect(lines).toHaveLength(2);
    expect(lines[0]).toContain("Company");
    expect(lines[0]).toContain("Conviction Score");
    expect(lines[1]).toContain("Dow Polyurethanes");
  });

  it("maps deal type to human label", () => {
    const out = radarToCsv([base]);
    expect(out).toContain("Carveout");
    expect(out).not.toContain("carveout");
  });

  it("maps stage to human label", () => {
    const out = radarToCsv([base]);
    expect(out).toContain("In Market");
    expect(out).not.toContain("in_market");
  });

  it("maps private_asset deal type", () => {
    const out = radarToCsv([{ ...base, dealType: "private_asset" }]);
    expect(out).toContain("Private Asset");
  });

  it("conviction score blank when missing", () => {
    const out = radarToCsv([{ ...base, conviction: undefined }]);
    const row = out.split("\r\n")[1]!;
    const cols = row.split(",");
    const convIdx = RADAR_CSV_COLUMNS.findIndex((c) => c.header === "Conviction Score");
    expect(cols[convIdx]).toBe("");
  });

  it("empty array returns header only", () => {
    const out = radarToCsv([]);
    const lines = out.split("\r\n");
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain("Company");
  });

  it("revenue / ebitda blank when null", () => {
    const out = radarToCsv([{ ...base, revenue: null, ebitda: null }]);
    const row = out.split("\r\n")[1]!;
    const revenueIdx = RADAR_CSV_COLUMNS.findIndex((c) => c.header === "Revenue");
    const ebitdaIdx = RADAR_CSV_COLUMNS.findIndex((c) => c.header === "EBITDA");
    const cols = row.split(",");
    expect(cols[revenueIdx]).toBe("");
    expect(cols[ebitdaIdx]).toBe("");
  });

  it("company name with comma is quoted", () => {
    const out = radarToCsv([{ ...base, name: "Acme, Inc." }]);
    expect(out).toContain('"Acme, Inc."');
  });

  it("formula injection prevention: name starting with = is prefixed", () => {
    const out = radarToCsv([{ ...base, name: "=SUM(A1)" }]);
    expect(out).toContain("'=SUM(A1)");
  });
});
