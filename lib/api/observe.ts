import { randomUUID } from "crypto";
import { type NextRequest } from "next/server";
import { runWithRequestId } from "@/lib/request-context";
import { serverError } from "@/lib/api/respond";
import { captureException } from "@/lib/observability";
import { log } from "@/lib/logger";

// Higher-order wrapper for route handlers: binds the request id into async
// context (so every log line + error report inside carries it), records a
// structured access log with status + duration, and turns an unhandled throw
// into a generic 500 (captured server-side). Wrap a handler:
//   export const GET = withObservedRoute("v1.companies", async (req) => { ... });
export function withObservedRoute<Args extends unknown[]>(
  name: string,
  handler: (req: NextRequest, ...args: Args) => Promise<Response>
) {
  return async (req: NextRequest, ...args: Args): Promise<Response> => {
    const requestId = req.headers.get("x-request-id") ?? randomUUID();
    const start = Date.now();
    return runWithRequestId(requestId, async () => {
      try {
        const res = await handler(req, ...args);
        log.info("api", {
          route: name,
          method: req.method,
          status: res.status,
          ms: Date.now() - start,
        });
        res.headers.set("x-request-id", requestId);
        return res;
      } catch (e) {
        captureException(e, { route: name, method: req.method });
        log.error("api unhandled", { route: name, ms: Date.now() - start });
        const res = serverError(e);
        res.headers.set("x-request-id", requestId);
        return res;
      }
    });
  };
}
