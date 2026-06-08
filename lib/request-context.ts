// Per-request context carried via AsyncLocalStorage so logs + error reports can
// be correlated without threading a requestId through every function signature.
// Node-only (route handlers run on the Node runtime); never import from edge
// middleware.

import { AsyncLocalStorage } from "node:async_hooks";

interface RequestContext {
  requestId: string;
}

const storage = new AsyncLocalStorage<RequestContext>();

export function runWithRequestId<T>(requestId: string, fn: () => T): T {
  return storage.run({ requestId }, fn);
}

export function currentRequestId(): string | undefined {
  return storage.getStore()?.requestId;
}
