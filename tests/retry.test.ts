import { describe, it, expect } from "vitest";
import { withRetry, isTransient, throwIfRetryableStatus } from "@/lib/retry";

const noSleep = async () => {};

describe("withRetry", () => {
  it("returns on the first success", async () => {
    let calls = 0;
    const r = await withRetry(
      async () => {
        calls++;
        return "ok";
      },
      { sleepFn: noSleep }
    );
    expect(r).toBe("ok");
    expect(calls).toBe(1);
  });

  it("retries transient failures then succeeds", async () => {
    let calls = 0;
    const r = await withRetry(
      async () => {
        calls++;
        if (calls < 3) throw { status: 500 };
        return "ok";
      },
      { sleepFn: noSleep, baseMs: 1 }
    );
    expect(r).toBe("ok");
    expect(calls).toBe(3);
  });

  it("gives up after retries are exhausted", async () => {
    let calls = 0;
    await expect(
      withRetry(
        async () => {
          calls++;
          throw { status: 503 };
        },
        { retries: 2, sleepFn: noSleep }
      )
    ).rejects.toMatchObject({ status: 503 });
    expect(calls).toBe(3); // 1 + 2 retries
  });

  it("does not retry a non-transient error", async () => {
    let calls = 0;
    await expect(
      withRetry(
        async () => {
          calls++;
          throw { status: 400 };
        },
        { retries: 3, sleepFn: noSleep }
      )
    ).rejects.toMatchObject({ status: 400 });
    expect(calls).toBe(1);
  });
});

describe("isTransient", () => {
  it("classifies statuses", () => {
    expect(isTransient({ status: 429 })).toBe(true);
    expect(isTransient({ status: 500 })).toBe(true);
    expect(isTransient({ status: 404 })).toBe(false);
    expect(isTransient(new Error("network"))).toBe(true); // no status
  });
});

describe("throwIfRetryableStatus", () => {
  it("throws on 5xx/429, passes others through", () => {
    expect(() => throwIfRetryableStatus(new Response("", { status: 500 }))).toThrow();
    const okRes = new Response("", { status: 200 });
    expect(throwIfRetryableStatus(okRes)).toBe(okRes);
  });
});
