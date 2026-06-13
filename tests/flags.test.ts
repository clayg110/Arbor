import { describe, it, expect } from "vitest";
import { resolveFlag, type FlagRow } from "@/lib/flags";

describe("resolveFlag", () => {
  it("defaults ON when there is no row for the key", () => {
    expect(resolveFlag([], "integration.crm")).toBe(true);
    expect(
      resolveFlag([{ key: "other", org_id: null, enabled: false }], "integration.crm")
    ).toBe(true);
  });

  it("honors a global row (org_id NULL)", () => {
    const rows: FlagRow[] = [{ key: "integration.enrich", org_id: null, enabled: false }];
    expect(resolveFlag(rows, "integration.enrich")).toBe(false);
  });

  it("lets a per-org row override the global default", () => {
    const rows: FlagRow[] = [
      { key: "integration.crm", org_id: null, enabled: false }, // off globally
      { key: "integration.crm", org_id: "org-1", enabled: true }, // on for org-1
    ];
    expect(resolveFlag(rows, "integration.crm", "org-1")).toBe(true);
    expect(resolveFlag(rows, "integration.crm", "org-2")).toBe(false); // falls back to global
  });

  it("falls back to global when the org has no specific row", () => {
    const rows: FlagRow[] = [{ key: "ingest.enabled", org_id: null, enabled: false }];
    expect(resolveFlag(rows, "ingest.enabled", "org-9")).toBe(false);
  });

  it("ignores org rows when no orgId is supplied", () => {
    const rows: FlagRow[] = [
      { key: "llm.enabled", org_id: "org-1", enabled: false },
      { key: "llm.enabled", org_id: null, enabled: true },
    ];
    expect(resolveFlag(rows, "llm.enabled")).toBe(true);
  });

  it("an org-only row (no global) still applies to that org and defaults others ON", () => {
    const rows: FlagRow[] = [{ key: "integration.hsr", org_id: "org-1", enabled: false }];
    expect(resolveFlag(rows, "integration.hsr", "org-1")).toBe(false);
    expect(resolveFlag(rows, "integration.hsr", "org-2")).toBe(true);
  });
});
