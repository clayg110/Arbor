import { describe, it, expect, afterEach, vi } from "vitest";
import { sendAlert, notifyPipelineFailure, notifyPipelineCrash, hasAlertEnv } from "@/lib/alerts";
import { transcriptTickers, hasTranscriptEnv } from "@/lib/ingest/transcripts";
import { logoLookupEnabled } from "@/lib/ingest/logo";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("alerts", () => {
  it("is a no-op without a webhook", async () => {
    vi.stubEnv("ALERT_WEBHOOK_URL", "");
    expect(hasAlertEnv()).toBe(false);
    expect(await sendAlert("hi")).toBe(false);
  });

  it("does not dispatch when a run has no errors", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("ALERT_WEBHOOK_URL", "https://hooks.example.com/x");
    const r = await notifyPipelineFailure({
      pipeline: "carveouts", fetched: 5, created: 1, updated: 2, flagged: 0, errors: 0,
    });
    expect(r).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("posts to the webhook on errors", async () => {
    const fetchMock = vi.fn(async () => ({ ok: true }) as unknown as Response);
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("ALERT_WEBHOOK_URL", "https://hooks.example.com/x");
    const r = await notifyPipelineFailure({
      pipeline: "carveouts", fetched: 5, created: 1, updated: 2, flagged: 0, errors: 3,
    });
    expect(r).toBe(true);
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://hooks.example.com/x");
    expect(String(init.body)).toContain("carveouts");
    expect(String(init.body)).toContain("3 errors");
  });

  it("swallows webhook failures (crash notify)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("network"); }));
    vi.stubEnv("ALERT_WEBHOOK_URL", "https://hooks.example.com/x");
    expect(await notifyPipelineCrash("carveouts", new Error("boom"))).toBe(false);
  });
});

describe("transcript config", () => {
  it("parses + uppercases + trims tickers", () => {
    vi.stubEnv("TRANSCRIPT_TICKERS", " dow, dd , ge ");
    expect(transcriptTickers()).toEqual(["DOW", "DD", "GE"]);
  });

  it("requires both key and tickers", () => {
    vi.stubEnv("FMP_API_KEY", "");
    vi.stubEnv("TRANSCRIPT_TICKERS", "DOW");
    expect(hasTranscriptEnv()).toBe(false);
    vi.stubEnv("FMP_API_KEY", "k");
    expect(hasTranscriptEnv()).toBe(true);
    vi.stubEnv("TRANSCRIPT_TICKERS", "");
    expect(hasTranscriptEnv()).toBe(false);
  });
});

describe("logo config", () => {
  it("honors the disable flag", () => {
    vi.stubEnv("LOGO_API_DISABLED", "1");
    expect(logoLookupEnabled()).toBe(false);
    vi.stubEnv("LOGO_API_DISABLED", "");
    expect(logoLookupEnabled()).toBe(true);
  });
});
