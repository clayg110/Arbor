import { describe, it, expect } from "vitest";
import { parseFilingTitle, parseHsrResponse, hasHsrEnv } from "@/lib/ingest/hsr";

describe("parseFilingTitle", () => {
  it("splits standard slash format", () => {
    const r = parseFilingTitle("Acme Corp / TargetCo Inc");
    expect(r).toEqual({ acquirer: "Acme Corp", target: "TargetCo Inc" });
  });

  it("trims whitespace around slash", () => {
    const r = parseFilingTitle("  Buyer LLC  /  Seller Ltd  ");
    expect(r).toEqual({ acquirer: "Buyer LLC", target: "Seller Ltd" });
  });

  it("returns empty acquirer for bare title", () => {
    const r = parseFilingTitle("Standalone Target Inc");
    expect(r).toEqual({ acquirer: "", target: "Standalone Target Inc" });
  });

  it("returns null for empty string", () => {
    expect(parseFilingTitle("")).toBeNull();
    expect(parseFilingTitle("   ")).toBeNull();
  });

  it("handles title with multiple slashes — first / is split point", () => {
    const r = parseFilingTitle("A Corp / B Ltd / Extra");
    // "A Corp" / "B Ltd / Extra"
    expect(r?.acquirer).toBe("A Corp");
    expect(r?.target).toBe("B Ltd / Extra");
  });
});

describe("parseHsrResponse", () => {
  const baseUrl = "https://example.ftc.gov/hsr";

  it("returns empty array for non-object input", () => {
    expect(parseHsrResponse(null, baseUrl)).toEqual([]);
    expect(parseHsrResponse("string", baseUrl)).toEqual([]);
    expect(parseHsrResponse(42, baseUrl)).toEqual([]);
  });

  it("returns empty array when hits missing", () => {
    expect(parseHsrResponse({}, baseUrl)).toEqual([]);
    expect(parseHsrResponse({ hits: {} }, baseUrl)).toEqual([]);
  });

  it("parses valid FTC Elasticsearch format", () => {
    const raw = {
      hits: {
        hits: [
          {
            _source: {
              title: "Global PE Fund / IndustrialCo LLC",
              date: "2025-03-15",
              transaction_number: "HSR-20250315-001",
            },
          },
        ],
      },
    };
    const filings = parseHsrResponse(raw, baseUrl);
    expect(filings).toHaveLength(1);
    expect(filings[0]).toMatchObject({
      transactionId: "HSR-20250315-001",
      acquirer: "Global PE Fund",
      target: "IndustrialCo LLC",
      filedDate: "2025-03-15",
      sourceUrl: `${baseUrl}/HSR-20250315-001`,
    });
  });

  it("truncates date to YYYY-MM-DD", () => {
    const raw = {
      hits: {
        hits: [
          {
            _source: {
              title: "Buyer / Target",
              date: "2025-06-01T00:00:00Z",
              transaction_number: "T1",
            },
          },
        ],
      },
    };
    const filings = parseHsrResponse(raw, baseUrl);
    expect(filings[0].filedDate).toBe("2025-06-01");
  });

  it("skips entries with missing _source", () => {
    const raw = {
      hits: {
        hits: [{ _source: null }, { other: "field" }],
      },
    };
    expect(parseHsrResponse(raw, baseUrl)).toEqual([]);
  });

  it("skips entries with blank title", () => {
    const raw = {
      hits: {
        hits: [
          { _source: { title: "   ", date: "2025-01-01", transaction_number: "X" } },
        ],
      },
    };
    expect(parseHsrResponse(raw, baseUrl)).toEqual([]);
  });

  it("handles multiple hits", () => {
    const raw = {
      hits: {
        hits: [
          {
            _source: {
              title: "A Corp / B Inc",
              date: "2025-01-10",
              transaction_number: "T1",
            },
          },
          {
            _source: {
              title: "C LLC / D Ltd",
              date: "2025-01-11",
              transaction_number: "T2",
            },
          },
        ],
      },
    };
    const filings = parseHsrResponse(raw, baseUrl);
    expect(filings).toHaveLength(2);
    expect(filings[0].target).toBe("B Inc");
    expect(filings[1].target).toBe("D Ltd");
  });
});

describe("hasHsrEnv", () => {
  it("returns false when HSR_SOURCE_URL not set", () => {
    const prev = process.env.HSR_SOURCE_URL;
    delete process.env.HSR_SOURCE_URL;
    expect(hasHsrEnv()).toBe(false);
    if (prev !== undefined) process.env.HSR_SOURCE_URL = prev;
  });

  it("returns true when HSR_SOURCE_URL is set", () => {
    process.env.HSR_SOURCE_URL = "https://example.ftc.gov/hsr";
    expect(hasHsrEnv()).toBe(true);
    delete process.env.HSR_SOURCE_URL;
  });
});
