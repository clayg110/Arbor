import { describe, it, expect } from "vitest";
import { domainFromEmail } from "@/lib/sso";

describe("domainFromEmail", () => {
  it("extracts the domain from an email", () => {
    expect(domainFromEmail("Jane.Doe@Acme.COM")).toBe("acme.com");
    expect(domainFromEmail("x@sub.acme.co.uk")).toBe("sub.acme.co.uk");
  });
  it("accepts a bare domain", () => {
    expect(domainFromEmail("acme.com")).toBe("acme.com");
  });
  it("rejects junk", () => {
    expect(domainFromEmail("")).toBeNull();
    expect(domainFromEmail("nope")).toBeNull();
    expect(domainFromEmail("a@b")).toBeNull();
    expect(domainFromEmail("has space.com")).toBeNull();
  });
});
