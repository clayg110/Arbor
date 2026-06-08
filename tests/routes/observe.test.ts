import { describe, it, expect, vi } from "vitest";
import { NextRequest } from "next/server";
import { withObservedRoute } from "@/lib/api/observe";

function req(): NextRequest {
  return new NextRequest("http://x/api/demo", { headers: { "x-request-id": "rid-1" } });
}

describe("withObservedRoute", () => {
  it("passes through the handler response + echoes the request id", async () => {
    const handler = withObservedRoute(
      "demo",
      async () => new Response(null, { status: 204 })
    );
    const res = await handler(req());
    expect(res.status).toBe(204);
    expect(res.headers.get("x-request-id")).toBe("rid-1");
  });

  it("turns an unhandled throw into a generic 500 (no leak)", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const handler = withObservedRoute("demo", async () => {
      throw new Error("boom: secret detail");
    });
    const res = await handler(req());
    expect(res.status).toBe(500);
    expect(res.headers.get("x-request-id")).toBe("rid-1");
    const json = (await res.json()) as { error: string };
    expect(json.error).toBe("Internal server error");
    expect(json.error).not.toContain("secret");
  });
});
