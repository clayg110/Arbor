// Minimal structured (JSON) logger — node + edge, zero deps. One line of JSON
// per event so logs are greppable and ingestible by any log platform. For
// errors you also want in Sentry, use captureException (lib/observability).

import { currentRequestId } from "./request-context";

type Level = "debug" | "info" | "warn" | "error";
type Fields = Record<string, unknown>;

function emit(level: Level, msg: string, fields?: Fields): void {
  const requestId = currentRequestId();
  const line = JSON.stringify({
    t: new Date().toISOString(),
    level,
    msg,
    ...(requestId ? { requestId } : {}),
    ...fields,
  });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const log = {
  debug: (msg: string, f?: Fields) => emit("debug", msg, f),
  info: (msg: string, f?: Fields) => emit("info", msg, f),
  warn: (msg: string, f?: Fields) => emit("warn", msg, f),
  error: (msg: string, f?: Fields) => emit("error", msg, f),
};
