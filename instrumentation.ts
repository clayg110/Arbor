// Server + edge runtime init (Next 15 instrumentation hook). Sentry only starts
// when SENTRY_DSN is set; otherwise this is a no-op and the SDK stays dormant.

export async function register(): Promise<void> {
  if (!process.env.SENTRY_DSN) return;
  if (process.env.NEXT_RUNTIME === "nodejs" || process.env.NEXT_RUNTIME === "edge") {
    const Sentry = await import("@sentry/nextjs");
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? 0.1),
      environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
    });
  }
}

// Pipe Next's nested React Server Component / route errors into Sentry.
export async function onRequestError(
  ...args: Parameters<typeof import("@sentry/nextjs").captureRequestError>
): Promise<void> {
  if (!process.env.SENTRY_DSN) return;
  const Sentry = await import("@sentry/nextjs");
  Sentry.captureRequestError(...args);
}
