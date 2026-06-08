import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { processSignal } from "@/lib/ingest/persist";
import type { ExtractedSignal } from "@/lib/extract-signal";
import type { SignalMeta } from "@/lib/ingest/persist";

// ---- fake Supabase client -------------------------------------------------
// Minimal chainable stub covering exactly the calls processSignal makes:
//   .from(t).insert(p).select("id").single()      (signals + create)
//   await .from(t).insert(p)                        (history)
//   .from(t).select(c).ilike().limit()             (resolve candidates)
//   .from(t).select("*").eq().maybeSingle()         (existing company)
//   .from(t).update(p).eq()                          (stage / financials)
interface Opts {
  candidates?: { id: string; name: string }[];
  companyRow?: Record<string, unknown> | null;
  createdId?: string;
}

function makeSvc(opts: Opts = {}) {
  const captured = {
    signalInserts: [] as Record<string, unknown>[],
    companyInserts: [] as Record<string, unknown>[],
    companyUpdates: [] as Record<string, unknown>[],
    historyInserts: [] as Record<string, unknown>[],
  };
  const createdId = opts.createdId ?? "created-1";

  const svc = {
    from(table: string) {
      return {
        insert(payload: Record<string, unknown>) {
          if (table === "signals_raw") captured.signalInserts.push(payload);
          else if (table === "companies") captured.companyInserts.push(payload);
          else if (table === "deal_stage_history") captured.historyInserts.push(payload);
          const idResult = {
            data: { id: table === "signals_raw" ? "sig-1" : createdId },
            error: null,
          };
          return {
            select: () => ({ single: async () => idResult }),
            // history insert is awaited directly (thenable)
            then: (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
              Promise.resolve({ data: null, error: null }).then(res, rej),
          };
        },
        // signals_raw now goes through upsert (dedupe_key ignore-duplicates).
        upsert(payload: Record<string, unknown>) {
          if (table === "signals_raw") captured.signalInserts.push(payload);
          const idResult = { data: { id: "sig-1" }, error: null };
          return {
            select: () => ({
              maybeSingle: async () => idResult,
              single: async () => idResult,
            }),
          };
        },
        select() {
          const builder: Record<string, unknown> = {
            eq: () => builder,
            ilike: () => builder,
            neq: () => builder,
            in: () => builder,
            order: () => builder,
            limit: async () => ({ data: opts.candidates ?? [], error: null }),
            maybeSingle: async () => ({ data: opts.companyRow ?? null, error: null }),
            single: async () => ({ data: opts.companyRow ?? null, error: null }),
          };
          return builder;
        },
        update(payload: Record<string, unknown>) {
          if (table === "companies") captured.companyUpdates.push(payload);
          return { eq: async () => ({ data: null, error: null }) };
        },
      };
    },
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { svc: svc as any, captured };
}

const meta: SignalMeta = {
  sourceType: "sec_filing",
  sourceName: "SEC EDGAR",
  docType: "8-K filing",
  sourceUrl: "https://sec.gov/x",
  rawText: "Dow announces strategic alternatives for its polyurethanes unit.",
};

const existing = { id: "co-1", current_stage: "monitor_for_exit", confidence: "medium" };

describe("processSignal", () => {
  beforeEach(() => {
    vi.stubEnv("LOGO_API_DISABLED", "1"); // no network on create
    vi.stubEnv("TYPESENSE_HOST", "");
    vi.stubEnv("TYPESENSE_API_KEY", "");
  });
  afterEach(() => vi.unstubAllEnvs());

  it("skips when no signal is found", async () => {
    const { svc, captured } = makeSvc();
    const ex = { found: false } as ExtractedSignal;
    const r = await processSignal(svc, ex, meta, "carveout");
    expect(r.outcome).toBe("skipped");
    expect(captured.signalInserts).toHaveLength(1);
    expect(captured.signalInserts[0].company_id).toBeNull();
  });

  it("creates a needs_review company on no match", async () => {
    const { svc, captured } = makeSvc({ candidates: [] });
    const ex: ExtractedSignal = {
      found: true,
      company_name: "Acme Specialty Chemicals",
      stage: "in_market",
      confidence: "high",
      sector: "chemicals",
      deal_type: "carveout",
    };
    const r = await processSignal(svc, ex, meta, "carveout");
    expect(r.outcome).toBe("created");
    expect(captured.companyInserts[0].name).toBe("Acme Specialty Chemicals");
    expect(captured.companyInserts[0].confidence).toBe("needs_review");
    expect(captured.companyInserts[0].logo_url).toBeNull();
    expect(captured.historyInserts[0].event_type).toBe("new_entry");
  });

  it("matches without change when stage is unchanged", async () => {
    const { svc, captured } = makeSvc({
      candidates: [{ id: "co-1", name: "Dow Polyurethanes" }],
      companyRow: existing,
    });
    const ex: ExtractedSignal = {
      found: true,
      company_name: "Dow Polyurethanes",
      stage: "monitor_for_exit",
      confidence: "high",
    };
    const r = await processSignal(svc, ex, meta, "carveout");
    expect(r.outcome).toBe("matched_nochange");
    expect(r.companyId).toBe("co-1");
    expect(captured.historyInserts).toHaveLength(0);
    expect(captured.companyUpdates).toHaveLength(0);
  });

  it("updates stage + writes history on a confident stage change", async () => {
    const { svc, captured } = makeSvc({
      candidates: [{ id: "co-1", name: "Dow Polyurethanes" }],
      companyRow: existing,
    });
    const ex: ExtractedSignal = {
      found: true,
      company_name: "Dow Polyurethanes",
      stage: "in_market",
      confidence: "high",
    };
    const r = await processSignal(svc, ex, meta, "carveout");
    expect(r.outcome).toBe("updated");
    expect(captured.companyUpdates[0].current_stage).toBe("in_market");
    expect(captured.historyInserts[0].stage).toBe("in_market");
    expect(captured.historyInserts[0].event_type).toBe("moved_in_market");
    expect(captured.historyInserts[0].changed_by).toBe("system_auto");
  });

  it("flags (no stage change) on a low-confidence match", async () => {
    const { svc, captured } = makeSvc({
      candidates: [{ id: "co-1", name: "Dow Polyurethanes" }],
      companyRow: existing,
    });
    const ex: ExtractedSignal = {
      found: true,
      company_name: "Dow Polyurethanes",
      stage: "in_market",
      confidence: "needs_review",
    };
    const r = await processSignal(svc, ex, meta, "carveout");
    expect(r.outcome).toBe("flagged");
    expect(captured.companyUpdates[0].confidence).toBe("needs_review");
    expect(captured.historyInserts).toHaveLength(0);
  });

  it("enriches financials on a no-stage-change match", async () => {
    const { svc, captured } = makeSvc({
      candidates: [{ id: "co-1", name: "Dow Polyurethanes" }],
      companyRow: existing,
    });
    const ex: ExtractedSignal = {
      found: true,
      company_name: "Dow Polyurethanes",
      stage: "monitor_for_exit",
      confidence: "high",
      revenue: "$1.2B",
    };
    const r = await processSignal(svc, ex, meta, "carveout");
    expect(r.outcome).toBe("matched_nochange");
    expect(captured.companyUpdates[0].revenue).toBe("$1.2B");
    expect(captured.companyUpdates[0].revenue_source_url).toBe(meta.sourceUrl);
  });
});
