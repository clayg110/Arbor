import { describe, it, expect } from "vitest";
import { buildCsp } from "@/lib/csp";

describe("buildCsp", () => {
  it("uses nonce + strict-dynamic (no script unsafe-inline) when a nonce is given", () => {
    const csp = buildCsp("abc123", false);
    expect(csp).toContain("script-src 'self' 'nonce-abc123' 'strict-dynamic'");
    expect(csp).not.toContain("script-src 'self' 'unsafe-inline'");
    expect(csp).not.toContain("'unsafe-eval'");
  });

  it("falls back to script unsafe-inline without a nonce (static landing)", () => {
    const csp = buildCsp(null, false);
    expect(csp).toContain("script-src 'self' 'unsafe-inline'");
    expect(csp).not.toContain("nonce-");
    expect(csp).not.toContain("strict-dynamic");
  });

  it("adds unsafe-eval only in dev", () => {
    expect(buildCsp("n", true)).toContain("'unsafe-eval'");
  });

  it("keeps the hardened directives + inline styles", () => {
    const csp = buildCsp("n", false);
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("style-src 'self' 'unsafe-inline'"); // inline style attrs
  });
});
