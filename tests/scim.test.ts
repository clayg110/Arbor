import { describe, it, expect } from "vitest";
import {
  toScimUser,
  parseUserNameFilter,
  patchActive,
  scimError,
  scimList,
} from "@/lib/scim";

describe("toScimUser", () => {
  it("maps to a SCIM core User resource", () => {
    const r = toScimUser({ id: "u1", email: "Jane@x.com", name: "Jane", active: true });
    expect(r.id).toBe("u1");
    expect(r.userName).toBe("Jane@x.com");
    expect(r.active).toBe(true);
    expect(r.emails[0]!.value).toBe("Jane@x.com");
    expect(r.schemas[0]).toContain("core:2.0:User");
  });
});

describe("parseUserNameFilter", () => {
  it("extracts the email from a userName eq filter", () => {
    expect(parseUserNameFilter('userName eq "Jane@x.com"')).toBe("jane@x.com");
    expect(parseUserNameFilter(null)).toBeNull();
    expect(parseUserNameFilter('displayName eq "x"')).toBeNull();
  });
});

describe("patchActive", () => {
  it("reads active from path form", () => {
    expect(
      patchActive({ Operations: [{ op: "replace", path: "active", value: false }] })
    ).toBe(false);
  });
  it("reads active from value-object form", () => {
    expect(
      patchActive({ Operations: [{ op: "replace", value: { active: true } }] })
    ).toBe(true);
  });
  it("coerces string booleans (Azure)", () => {
    expect(
      patchActive({ Operations: [{ op: "replace", path: "active", value: "False" }] })
    ).toBe(false);
  });
  it("returns null when active isn't touched", () => {
    expect(
      patchActive({ Operations: [{ op: "replace", path: "displayName", value: "x" }] })
    ).toBeNull();
  });
});

describe("envelopes", () => {
  it("error + list carry the SCIM schemas", () => {
    expect(scimError(404, "nope").schemas[0]).toContain("Error");
    const l = scimList([{ id: "a" }], 1, 1);
    expect(l.totalResults).toBe(1);
    expect(l.Resources).toHaveLength(1);
  });
});
