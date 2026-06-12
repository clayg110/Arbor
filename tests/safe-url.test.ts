import { describe, it, expect } from "vitest";
import { safeHttpUrl, isSafeOptionalUrl } from "@/lib/safe-url";

describe("safeHttpUrl", () => {
  it("passes through http(s) URLs", () => {
    expect(safeHttpUrl("https://linkedin.com/in/x")).toBe("https://linkedin.com/in/x");
    expect(safeHttpUrl("http://example.com/")).toBe("http://example.com/");
  });

  it("prepends https to schemeless input", () => {
    expect(safeHttpUrl("linkedin.com/in/x")).toBe("https://linkedin.com/in/x");
    expect(safeHttpUrl("  example.com  ")).toBe("https://example.com/");
  });

  it("rejects dangerous schemes (XSS vectors)", () => {
    expect(safeHttpUrl("javascript:alert(document.cookie)")).toBeNull();
    expect(safeHttpUrl("JavaScript:alert(1)")).toBeNull();
    expect(safeHttpUrl("data:text/html,<script>alert(1)</script>")).toBeNull();
    expect(safeHttpUrl("vbscript:msgbox(1)")).toBeNull();
    expect(safeHttpUrl("file:///etc/passwd")).toBeNull();
    expect(safeHttpUrl("mailto:x@y.com")).toBeNull();
  });

  it("returns null for empty / nullish", () => {
    expect(safeHttpUrl("")).toBeNull();
    expect(safeHttpUrl("   ")).toBeNull();
    expect(safeHttpUrl(null)).toBeNull();
    expect(safeHttpUrl(undefined)).toBeNull();
  });
});

describe("isSafeOptionalUrl", () => {
  it("allows empty / absent", () => {
    expect(isSafeOptionalUrl("")).toBe(true);
    expect(isSafeOptionalUrl("  ")).toBe(true);
    expect(isSafeOptionalUrl(null)).toBe(true);
    expect(isSafeOptionalUrl(undefined)).toBe(true);
  });
  it("allows safe URLs, rejects dangerous ones", () => {
    expect(isSafeOptionalUrl("linkedin.com/in/x")).toBe(true);
    expect(isSafeOptionalUrl("https://x.com")).toBe(true);
    expect(isSafeOptionalUrl("javascript:alert(1)")).toBe(false);
    expect(isSafeOptionalUrl("data:text/html,x")).toBe(false);
  });
});
