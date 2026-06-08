import { describe, it, expect } from "vitest";
import { openapiSpec } from "@/lib/openapi";

describe("openapiSpec", () => {
  it("is a valid 3.1 document with the companies path", () => {
    expect(openapiSpec.openapi).toBe("3.1.0");
    expect(openapiSpec.paths["/companies"].get.summary).toBeTruthy();
  });

  it("declares bearer auth + the core response codes", () => {
    expect(openapiSpec.components.securitySchemes.bearerAuth.scheme).toBe("bearer");
    const codes = Object.keys(openapiSpec.paths["/companies"].get.responses);
    expect(codes).toEqual(expect.arrayContaining(["200", "401", "403", "429"]));
  });

  it("round-trips through JSON (serializable)", () => {
    expect(() => JSON.parse(JSON.stringify(openapiSpec))).not.toThrow();
  });
});
