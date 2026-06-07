import { describe, it, expect } from "vitest";
import { generateApiKey, hashKey, bearerFrom, verifyApiKey } from "@/lib/api-keys";

function makeSvc(row: Record<string, unknown> | null) {
  const updates: Record<string, unknown>[] = [];
  const svc = {
    from() {
      return {
        select() {
          return { eq() { return { maybeSingle: async () => ({ data: row, error: null }) }; } };
        },
        update(payload: Record<string, unknown>) {
          updates.push(payload);
          return { eq: async () => ({ data: null, error: null }) };
        },
      };
    },
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { svc: svc as any, updates };
}

describe("api key generation", () => {
  it("produces a prefixed key whose hash is deterministic", () => {
    const k = generateApiKey();
    expect(k.prefix).toMatch(/^arbor_[0-9a-f]{8}$/);
    expect(k.plaintext.startsWith(k.prefix + "_")).toBe(true);
    expect(k.hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hashKey(k.plaintext)).toBe(k.hash);
  });

  it("is unique per call", () => {
    expect(generateApiKey().plaintext).not.toBe(generateApiKey().plaintext);
  });
});

describe("bearerFrom", () => {
  it("extracts the token", () => {
    expect(bearerFrom("Bearer arbor_abc")).toBe("arbor_abc");
    expect(bearerFrom("bearer  spaced ")).toBe("spaced");
  });
  it("returns null on missing/garbage", () => {
    expect(bearerFrom(null)).toBeNull();
    expect(bearerFrom("Basic xyz")).toBeNull();
  });
});

describe("verifyApiKey", () => {
  it("rejects keys without the arbor_ prefix (no DB hit)", async () => {
    const { svc } = makeSvc(null);
    expect(await verifyApiKey(svc, "nope")).toBeNull();
  });

  it("resolves a valid key to its org + bumps last_used_at", async () => {
    const k = generateApiKey();
    const { svc, updates } = makeSvc({ id: "key-1", org_id: "org-1", revoked_at: null });
    const r = await verifyApiKey(svc, k.plaintext);
    expect(r).toEqual({ keyId: "key-1", orgId: "org-1" });
    expect(updates[0]).toHaveProperty("last_used_at");
  });

  it("rejects revoked keys", async () => {
    const k = generateApiKey();
    const { svc } = makeSvc({ id: "key-1", org_id: "org-1", revoked_at: new Date().toISOString() });
    expect(await verifyApiKey(svc, k.plaintext)).toBeNull();
  });
});
