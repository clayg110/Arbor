import { describe, it, expect, vi } from "vitest";
import { recordFailure } from "@/lib/ingest/deadletter";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySvc = any;

describe("recordFailure", () => {
  it("inserts a dead-letter row", async () => {
    const insert = vi.fn(async () => ({ error: null }));
    const svc = { from: () => ({ insert }) } as AnySvc;
    await recordFailure(svc, {
      sourceUrl: "u",
      sourceType: "rss_feed",
      sourceName: "PE Wire",
      docType: "RSS feed",
      rawText: "t",
      reason: "extract_failed",
    });
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        source_url: "u",
        source_type: "rss_feed",
        reason: "extract_failed",
      })
    );
  });

  it("swallows insert errors (best-effort)", async () => {
    const svc = {
      from: () => ({
        insert: async () => {
          throw new Error("db down");
        },
      }),
    } as AnySvc;
    await expect(
      recordFailure(svc, {
        sourceUrl: "u",
        sourceType: "manual",
        sourceName: "n",
        docType: "d",
        rawText: "t",
        reason: "x",
      })
    ).resolves.toBeUndefined();
  });
});
