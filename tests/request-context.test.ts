import { describe, it, expect, vi, afterEach } from "vitest";
import { runWithRequestId, currentRequestId } from "@/lib/request-context";
import { log } from "@/lib/logger";

afterEach(() => vi.restoreAllMocks());

describe("request context", () => {
  it("has no id outside a run", () => {
    expect(currentRequestId()).toBeUndefined();
  });

  it("binds the id inside runWithRequestId", () => {
    const seen = runWithRequestId("rid-1", () => currentRequestId());
    expect(seen).toBe("rid-1");
    expect(currentRequestId()).toBeUndefined(); // not leaked after
  });

  it("auto-enriches log lines with the active requestId", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    runWithRequestId("rid-9", () => log.info("hello"));
    const payload = JSON.parse(spy.mock.calls[0][0] as string);
    expect(payload.requestId).toBe("rid-9");
  });

  it("omits requestId when none is bound", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    log.info("nope");
    const payload = JSON.parse(spy.mock.calls[0][0] as string);
    expect(payload.requestId).toBeUndefined();
  });
});
