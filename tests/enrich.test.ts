import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the I/O collaborators so the test exercises only enrich's routing +
// aggregation, not Google CSE or the real extract→persist pipeline.
const google = vi.hoisted(() => ({
  hasGoogleEnv: vi.fn(() => true),
  fetchCompanyWebSignals: vi.fn(),
  fetchDivestitureSignals: vi.fn(),
}));
const pipeline = vi.hoisted(() => ({ processItem: vi.fn() }));

vi.mock("@/lib/ingest/google", () => google);
vi.mock("@/lib/ingest/pipeline", () => pipeline);

import { enrichCompanyOnAdd } from "@/lib/ingest/enrich";

const SVC = {} as never;
const sig = (n: number) =>
  Array.from({ length: n }, (_, i) => ({
    rawText: `news ${i}`,
    sourceUrl: `https://x/${i}`,
    sourceName: "Example",
    docType: "News article",
  }));

beforeEach(() => {
  vi.clearAllMocks();
  google.hasGoogleEnv.mockReturnValue(true);
  google.fetchCompanyWebSignals.mockResolvedValue(sig(0));
  google.fetchDivestitureSignals.mockResolvedValue(sig(0));
});

describe("enrichCompanyOnAdd", () => {
  it("is a no-op when Google env is absent", async () => {
    google.hasGoogleEnv.mockReturnValue(false);
    const r = await enrichCompanyOnAdd(SVC, "Acme", "carveout");
    expect(r.searched).toBe(false);
    expect(r.fetched).toBe(0);
    expect(google.fetchDivestitureSignals).not.toHaveBeenCalled();
    expect(pipeline.processItem).not.toHaveBeenCalled();
  });

  it("uses divestiture search for carve-outs", async () => {
    google.fetchDivestitureSignals.mockResolvedValue(sig(2));
    const r = await enrichCompanyOnAdd(SVC, "Acme", "carveout");
    expect(google.fetchDivestitureSignals).toHaveBeenCalledWith("Acme", 3);
    expect(google.fetchCompanyWebSignals).not.toHaveBeenCalled();
    expect(r.searched).toBe(true);
    expect(r.fetched).toBe(2);
    expect(pipeline.processItem).toHaveBeenCalledTimes(2);
  });

  it("uses company-web search for private-asset deals", async () => {
    google.fetchCompanyWebSignals.mockResolvedValue(sig(1));
    const r = await enrichCompanyOnAdd(SVC, "Beta Co", "private_asset");
    expect(google.fetchCompanyWebSignals).toHaveBeenCalledWith("Beta Co", 3);
    expect(google.fetchDivestitureSignals).not.toHaveBeenCalled();
    expect(r.fetched).toBe(1);
    expect(pipeline.processItem).toHaveBeenCalledTimes(1);
  });

  it("passes google_news source items into the pipeline with the deal type", async () => {
    google.fetchDivestitureSignals.mockResolvedValue(sig(1));
    await enrichCompanyOnAdd(SVC, "Acme", "carveout");
    const [, meta, dealType] = pipeline.processItem.mock.calls[0]!;
    expect(meta.sourceType).toBe("google_news");
    expect(meta.rawText).toBe("news 0");
    expect(dealType).toBe("carveout");
  });

  it("aggregates outcome counts from the pipeline", async () => {
    google.fetchDivestitureSignals.mockResolvedValue(sig(2));
    // Simulate processItem bumping the shared counts object.
    pipeline.processItem.mockImplementation(
      async (
        _svc: unknown,
        _meta: unknown,
        _dt: unknown,
        counts: Record<string, number>
      ) => {
        counts.created = (counts.created ?? 0) + 1;
      }
    );
    const r = await enrichCompanyOnAdd(SVC, "Acme", "carveout");
    expect(r.created).toBe(2);
    expect(r.errors).toBe(0);
  });

  it("respects a custom limit", async () => {
    google.fetchDivestitureSignals.mockResolvedValue(sig(0));
    await enrichCompanyOnAdd(SVC, "Acme", "carveout", 5);
    expect(google.fetchDivestitureSignals).toHaveBeenCalledWith("Acme", 5);
  });
});
