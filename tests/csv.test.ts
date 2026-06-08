import { describe, it, expect } from "vitest";
import { escapeCsvCell, toCsv, type CsvColumn } from "@/lib/csv";

describe("escapeCsvCell", () => {
  it("renders null / undefined as empty", () => {
    expect(escapeCsvCell(null)).toBe("");
    expect(escapeCsvCell(undefined)).toBe("");
  });

  it("passes simple values through unquoted", () => {
    expect(escapeCsvCell("hello")).toBe("hello");
    expect(escapeCsvCell(42)).toBe("42");
    expect(escapeCsvCell(-7)).toBe("-7"); // numbers are never formula-escaped
  });

  it("quotes + doubles quotes for commas, quotes, and newlines", () => {
    expect(escapeCsvCell("a,b")).toBe('"a,b"');
    expect(escapeCsvCell('she said "hi"')).toBe('"she said ""hi"""');
    expect(escapeCsvCell("line1\nline2")).toBe('"line1\nline2"');
  });

  it("serializes objects (jsonb metadata) as JSON, then quotes", () => {
    expect(escapeCsvCell({ a: 1, b: "x,y" })).toBe('"{""a"":1,""b"":""x,y""}"');
  });

  it("defuses CSV formula injection on string cells only", () => {
    expect(escapeCsvCell("=1+1")).toBe("'=1+1");
    expect(escapeCsvCell("+cmd")).toBe("'+cmd");
    expect(escapeCsvCell("-2+3")).toBe("'-2+3");
    expect(escapeCsvCell("@SUM(A1)")).toBe("'@SUM(A1)");
    // a cell needing both formula-guard AND quoting
    expect(escapeCsvCell("=HYPERLINK(x,y)")).toBe('"\'=HYPERLINK(x,y)"');
  });
});

describe("toCsv", () => {
  interface Row {
    id: string;
    n: number;
    meta: unknown;
  }
  const cols: CsvColumn<Row>[] = [
    { header: "id", value: (r) => r.id },
    { header: "n", value: (r) => r.n },
    { header: "meta", value: (r) => r.meta },
  ];

  it("emits a header row then CRLF-joined data rows", () => {
    const csv = toCsv(
      [
        { id: "a", n: 1, meta: null },
        { id: "b,c", n: 2, meta: { k: "v" } },
      ],
      cols
    );
    expect(csv).toBe(["id,n,meta", "a,1,", '"b,c",2,"{""k"":""v""}"'].join("\r\n"));
  });

  it("emits just the header for an empty dataset", () => {
    expect(toCsv([], cols)).toBe("id,n,meta");
  });
});
