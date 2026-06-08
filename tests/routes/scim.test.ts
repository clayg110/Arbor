import { describe, it, expect, vi } from "vitest";
import { NextRequest } from "next/server";
import { makeClient, installClient } from "../helpers/sb";

vi.mock("@/lib/supabase/server", () => ({
  hasSupabaseEnv: () => true,
  createClient: async () => (globalThis as Record<string, unknown>).__sb,
  createServiceClient: () => (globalThis as Record<string, unknown>).__sb,
}));

import { GET } from "@/app/api/scim/v2/Users/route";

function req(token?: string): NextRequest {
  return new NextRequest("http://x/api/scim/v2/Users", {
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });
}

describe("GET /api/scim/v2/Users (auth)", () => {
  it("401 without a bearer token", async () => {
    installClient(makeClient({ result: { data: null, error: null } }));
    expect((await GET(req())).status).toBe(401);
  });

  it("401 when the token matches no org", async () => {
    installClient(makeClient({ result: { data: null, error: null } }));
    expect((await GET(req("scim_unknown"))).status).toBe(401);
  });

  it("lists org members for a valid token", async () => {
    installClient(
      makeClient({
        result: { data: { id: "org-1" }, error: null }, // orgs lookup by token hash
        admin: {
          listUsers: async () => ({
            data: {
              users: [
                {
                  id: "u1",
                  email: "a@x.com",
                  app_metadata: { org_id: "org-1" },
                  user_metadata: {},
                },
                {
                  id: "u2",
                  email: "b@x.com",
                  app_metadata: { org_id: "other" },
                  user_metadata: {},
                },
              ],
            },
            error: null,
          }),
        },
      })
    );
    const res = await GET(req("scim_good"));
    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      totalResults: number;
      Resources: { id: string }[];
    };
    expect(json.totalResults).toBe(1);
    expect(json.Resources[0].id).toBe("u1");
  });
});
