import { describe, it, expect } from "vitest";
import { isComputedSort, rankComputed, COMPUTED_SORT_CAP } from "@/lib/radar-rank";
import type { RadarCompany } from "@/lib/radar-data";
import type { Confidence } from "@/lib/types";

// Minimal RadarCompany — rankComputed only reads name/conviction.score/confidence.
function rc(
  name: string,
  score: number,
  confidence: Confidence = "medium"
): RadarCompany {
  return {
    id: name,
    companyId: name,
    name,
    conviction: { score, band: "warm" },
    confidence,
  } as RadarCompany;
}

const names = (rows: RadarCompany[]) => rows.map((r) => r.name);

describe("isComputedSort", () => {
  it("flags conviction + confidence sorts", () => {
    for (const s of ["conv_desc", "conv_asc", "conf_desc", "conf_asc"]) {
      expect(isComputedSort(s)).toBe(true);
    }
  });
  it("rejects DB-orderable sorts", () => {
    for (const s of [
      "days_desc",
      "days_asc",
      "name_asc",
      "name_desc",
      "added_desc",
      "",
    ]) {
      expect(isComputedSort(s)).toBe(false);
    }
  });
});

describe("rankComputed — conviction", () => {
  // Input order mimics the DB's secondary order (name asc): the hottest company
  // (E, 90) sits LAST. The old paginate-then-sort bug would never surface it on
  // page 1; rankComputed must.
  const input = [rc("A", 10), rc("B", 50), rc("C", 30), rc("D", 70), rc("E", 90)];

  it("conv_desc page 1 returns the globally highest scores, not the page's", () => {
    expect(names(rankComputed(input, "conv_desc", 0, 2))).toEqual(["E", "D"]);
  });

  it("conv_desc paginates correctly across pages", () => {
    expect(names(rankComputed(input, "conv_desc", 2, 2))).toEqual(["B", "C"]);
    expect(names(rankComputed(input, "conv_desc", 4, 2))).toEqual(["A"]);
  });

  it("conv_asc reverses the order", () => {
    expect(names(rankComputed(input, "conv_asc", 0, 3))).toEqual(["A", "C", "B"]);
  });

  it("treats a missing conviction score as 0", () => {
    const withMissing = [
      rc("X", 40),
      { id: "Y", companyId: "Y", name: "Y" } as RadarCompany,
    ];
    expect(names(rankComputed(withMissing, "conv_desc", 0, 2))).toEqual(["X", "Y"]);
  });

  it("is stable: equal scores keep input (DB) order", () => {
    const ties = [rc("A", 50), rc("B", 50), rc("C", 50)];
    expect(names(rankComputed(ties, "conv_desc", 0, 3))).toEqual(["A", "B", "C"]);
  });

  it("does not mutate the input array", () => {
    const original = [...input];
    rankComputed(input, "conv_desc", 0, 5);
    expect(names(input)).toEqual(names(original));
  });
});

describe("rankComputed — confidence", () => {
  const input = [
    rc("low1", 0, "low"),
    rc("high1", 0, "high"),
    rc("needs", 0, "needs_review"),
    rc("med1", 0, "medium"),
  ];

  it("conf_desc ranks high → needs_review", () => {
    expect(names(rankComputed(input, "conf_desc", 0, 4))).toEqual([
      "high1",
      "med1",
      "low1",
      "needs",
    ]);
  });

  it("conf_asc ranks needs_review → high", () => {
    expect(names(rankComputed(input, "conf_asc", 0, 4))).toEqual([
      "needs",
      "low1",
      "med1",
      "high1",
    ]);
  });
});

describe("COMPUTED_SORT_CAP", () => {
  it("is a sane positive bound", () => {
    expect(COMPUTED_SORT_CAP).toBeGreaterThanOrEqual(500);
  });
});
