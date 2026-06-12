// Stateless, signed tokens for the calendar subscription feed. A calendar app
// polls a plain URL with no auth header, so the feed is secured by an
// unguessable token in the path: base64url(userId) + "." + HMAC-SHA256(secret).
//
// Dormant until CALENDAR_FEED_SECRET is set: without it `hasCalendarEnv` is
// false, the feed route 404s, and the settings card shows the disabled state.
// No table — the token is self-describing and verified by recomputing the MAC.

import { createHmac, timingSafeEqual } from "node:crypto";

export function hasCalendarEnv(): boolean {
  return !!process.env.CALENDAR_FEED_SECRET;
}

function secret(): string {
  const s = process.env.CALENDAR_FEED_SECRET;
  if (!s) throw new Error("CALENDAR_FEED_SECRET not set");
  return s;
}

function b64url(buf: Buffer): string {
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function sign(payload: string): string {
  return b64url(createHmac("sha256", secret()).update(payload).digest());
}

// Build the token embedded in a user's feed URL.
export function makeCalendarToken(userId: string): string {
  const payload = b64url(Buffer.from(userId, "utf8"));
  return `${payload}.${sign(payload)}`;
}

// Verify a feed token and return the userId, or null if malformed/forged.
export function verifyCalendarToken(token: string): string | null {
  if (!hasCalendarEnv()) return null;
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const payload = token.slice(0, dot);
  const mac = token.slice(dot + 1);
  const expected = sign(payload);
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const userId = Buffer.from(
      payload.replace(/-/g, "+").replace(/_/g, "/"),
      "base64"
    ).toString("utf8");
    return userId || null;
  } catch {
    return null;
  }
}
