import { describe, it, expect } from "vitest";
import {
  validateUpload,
  extractFinancials,
  hasAnyFinancials,
  formatBytes,
  isDocumentKind,
  MAX_DOCUMENT_BYTES,
} from "@/lib/documents";

describe("validateUpload", () => {
  const pdf = (over = {}) => ({
    name: "cim.pdf",
    sizeBytes: 1_000_000,
    contentType: "application/pdf",
    ...over,
  });

  it("accepts a normal PDF", () => {
    expect(validateUpload(pdf())).toEqual({ ok: true });
  });

  it("rejects an empty name, empty file, oversize, and bad type", () => {
    expect(validateUpload(pdf({ name: "  " })).ok).toBe(false);
    expect(validateUpload(pdf({ sizeBytes: 0 })).ok).toBe(false);
    expect(validateUpload(pdf({ sizeBytes: MAX_DOCUMENT_BYTES + 1 })).ok).toBe(false);
    expect(validateUpload(pdf({ contentType: "application/x-msdownload" })).ok).toBe(
      false
    );
  });
});

describe("formatBytes", () => {
  it("scales B / KB / MB", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(2048)).toBe("2 KB");
    expect(formatBytes(5 * 1024 * 1024)).toBe("5.0 MB");
  });
});

describe("isDocumentKind", () => {
  it("guards the enum", () => {
    expect(isDocumentKind("cim")).toBe(true);
    expect(isDocumentKind("invoice")).toBe(false);
    expect(isDocumentKind(3)).toBe(false);
  });
});

describe("extractFinancials", () => {
  it("pulls revenue, EBITDA, margin and multiple from CIM-style text", () => {
    const text =
      "FY2025 revenue of $420 million, with EBITDA of $85M (a 20% EBITDA margin). " +
      "The business is being marketed at approximately 11.5x EBITDA.";
    const f = extractFinancials(text);
    expect(f.revenue).toBe("$420M");
    expect(f.ebitda).toBe("$85M");
    expect(f.margin).toBe("20%");
    expect(f.multiple).toBe("11.5x");
    expect(f.evidence.length).toBeGreaterThanOrEqual(3);
  });

  it("normalizes billions and stripped commas", () => {
    const f = extractFinancials("Generated $1.2 billion in revenue last year.");
    expect(f.revenue).toBe("$1.2B");
  });

  it("matches a money-first phrasing", () => {
    const f = extractFinancials("$340mm in net sales across the division.");
    expect(f.revenue).toBe("$340M");
  });

  it("returns nulls when nothing is stated", () => {
    const f = extractFinancials(
      "This teaser describes a leading specialty chemicals maker."
    );
    expect(f).toMatchObject({
      revenue: null,
      ebitda: null,
      margin: null,
      multiple: null,
    });
    expect(hasAnyFinancials(f)).toBe(false);
  });

  it("is empty-input safe", () => {
    expect(extractFinancials("").evidence).toEqual([]);
  });

  it("hasAnyFinancials is true when at least one figure is found", () => {
    expect(hasAnyFinancials(extractFinancials("EBITDA of $50M."))).toBe(true);
  });
});
