import { describe, it, expect, beforeEach, vi } from "vitest";
import type { CircuitBreaker } from "@/lib/circuit";
import type { SignalMeta } from "@/lib/ingest/persist";

vi.mock("@/lib/extract-signal", () => ({ extractSignal: vi.fn() }));
vi.mock("@/lib/ingest/persist", () => ({ processSignal: vi.fn() }));
vi.mock("@/lib/ingest/deadletter", () => ({ recordFailure: vi.fn(async () => {}) }));

import { processItem } from "@/lib/ingest/pipeline";
import { extractSignal } from "@/lib/extract-signal";
import { processSignal } from "@/lib/ingest/persist";
import { recordFailure } from "@/lib/ingest/deadletter";

const meta: SignalMeta = {
  sourceType: "rss_feed",
  sourceName: "PE Wire",
  docType: "RSS feed",
  sourceUrl: "https://x/1",
  rawText: "Acme explores strategic alternatives.",
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const svc = {} as any;

function fakeBreaker(open: boolean) {
  return {
    isOpen: () => open,
    recordSuccess: vi.fn(),
    recordFailure: vi.fn(),
  } as unknown as CircuitBreaker;
}

describe("processItem", () => {
  beforeEach(() => vi.clearAllMocks());

  it("skips + dead-letters when the breaker is open", async () => {
    const counts: Record<string, number> = {};
    await processItem(svc, meta, "private_asset", counts, fakeBreaker(true));
    expect(counts.errors).toBe(1);
    expect(extractSignal).not.toHaveBeenCalled();
    expect(recordFailure).toHaveBeenCalledWith(
      svc,
      expect.objectContaining({ reason: "circuit_open" })
    );
  });

  it("dead-letters + trips the breaker on a hard extraction failure", async () => {
    vi.mocked(extractSignal).mockResolvedValue(null);
    const breaker = fakeBreaker(false);
    const counts: Record<string, number> = {};
    await processItem(svc, meta, "private_asset", counts, breaker);
    expect(counts.errors).toBe(1);
    expect(breaker.recordFailure).toHaveBeenCalled();
    expect(recordFailure).toHaveBeenCalledWith(
      svc,
      expect.objectContaining({ reason: "extract_failed" })
    );
  });

  it("persists + records success on a good extraction", async () => {
    vi.mocked(extractSignal).mockResolvedValue({ found: true, company_name: "Acme" });
    vi.mocked(processSignal).mockResolvedValue({ outcome: "created", companyId: "c1" });
    const breaker = fakeBreaker(false);
    const counts: Record<string, number> = {};
    await processItem(svc, meta, "private_asset", counts, breaker);
    expect(counts.created).toBe(1);
    expect(breaker.recordSuccess).toHaveBeenCalled();
    expect(recordFailure).not.toHaveBeenCalled();
  });

  it("dead-letters when processing throws", async () => {
    vi.mocked(extractSignal).mockResolvedValue({ found: true, company_name: "Acme" });
    vi.mocked(processSignal).mockRejectedValue(new Error("boom"));
    const breaker = fakeBreaker(false);
    const counts: Record<string, number> = {};
    await processItem(svc, meta, "private_asset", counts, breaker);
    expect(counts.errors).toBe(1);
    expect(breaker.recordFailure).toHaveBeenCalled();
    expect(recordFailure).toHaveBeenCalledWith(
      svc,
      expect.objectContaining({ reason: "boom" })
    );
  });
});
