import { describe, it, expect } from "vitest";
import { CircuitBreaker } from "@/lib/circuit";

describe("CircuitBreaker", () => {
  it("starts closed", () => {
    expect(new CircuitBreaker().isOpen()).toBe(false);
  });

  it("opens after the failure threshold", () => {
    const t = 1000;
    const b = new CircuitBreaker({ threshold: 3, cooldownMs: 100, now: () => t });
    b.recordFailure();
    b.recordFailure();
    expect(b.isOpen()).toBe(false);
    b.recordFailure();
    expect(b.isOpen()).toBe(true);
  });

  it("half-opens after the cooldown, then re-opens on another failure", () => {
    let t = 1000;
    const b = new CircuitBreaker({ threshold: 1, cooldownMs: 100, now: () => t });
    b.recordFailure();
    expect(b.isOpen()).toBe(true);
    t += 150; // cooldown elapsed → trial allowed
    expect(b.isOpen()).toBe(false);
    b.recordFailure(); // trial failed
    expect(b.isOpen()).toBe(true);
  });

  it("resets on success", () => {
    const t = 1000;
    const b = new CircuitBreaker({ threshold: 3, cooldownMs: 100, now: () => t });
    b.recordFailure();
    b.recordFailure();
    b.recordSuccess();
    b.recordFailure();
    b.recordFailure();
    expect(b.isOpen()).toBe(false); // counter was reset, only 2 since
  });
});
