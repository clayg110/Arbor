import { describe, it, expect, vi, afterEach } from "vitest";
import { log } from "@/lib/logger";

afterEach(() => vi.restoreAllMocks());

describe("log", () => {
  it("emits one JSON line carrying level + msg + fields", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    log.info("hello", { reqId: "abc" });
    expect(spy).toHaveBeenCalledTimes(1);
    const payload = JSON.parse(spy.mock.calls[0][0] as string);
    expect(payload).toMatchObject({ level: "info", msg: "hello", reqId: "abc" });
    expect(typeof payload.t).toBe("string");
  });

  it("routes warn → console.warn and error → console.error", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    log.warn("careful");
    log.error("boom");
    expect(JSON.parse(warn.mock.calls[0][0] as string).level).toBe("warn");
    expect(JSON.parse(error.mock.calls[0][0] as string).level).toBe("error");
  });

  it("routes debug → console.log", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    log.debug("trace");
    expect(JSON.parse(spy.mock.calls[0][0] as string).level).toBe("debug");
  });
});
