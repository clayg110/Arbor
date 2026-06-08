import { describe, it, expect } from "vitest";
import { withSpan } from "@/lib/trace";

describe("withSpan", () => {
  it("runs the callback + returns its value (passthrough when tracing is off)", async () => {
    expect(await withSpan("x", "function", async () => 42)).toBe(42);
  });

  it("propagates errors", async () => {
    await expect(
      withSpan("x", "function", async () => {
        throw new Error("boom");
      })
    ).rejects.toThrow("boom");
  });
});
