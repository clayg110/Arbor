// Error capture. Always emits a structured log; also forwards to Sentry, which
// is a no-op until initialized (instrumentation.ts only inits when SENTRY_DSN is
// set), so this is safe to call unconditionally.

import * as Sentry from "@sentry/nextjs";
import { log } from "./logger";
import { currentRequestId } from "./request-context";

export function captureException(e: unknown, context?: Record<string, unknown>): void {
  const requestId = currentRequestId();
  const extra = { ...context, ...(requestId ? { requestId } : {}) };
  log.error(e instanceof Error ? e.message : String(e), {
    ...extra,
    stack: e instanceof Error ? e.stack : undefined,
  });
  Sentry.captureException(e, Object.keys(extra).length ? { extra } : undefined);
}

export function captureMessage(message: string, context?: Record<string, unknown>): void {
  log.warn(message, context);
  Sentry.captureMessage(message);
}
