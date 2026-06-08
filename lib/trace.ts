// Thin tracing wrapper. Sentry.startSpan runs the callback regardless of whether
// Sentry is initialized — when there's no DSN it's a transparent passthrough, so
// this is safe to call unconditionally (no perf cost when tracing is off).

import * as Sentry from "@sentry/nextjs";

export function withSpan<T>(name: string, op: string, fn: () => Promise<T>): Promise<T> {
  return Sentry.startSpan({ name, op }, fn);
}
