// Keyset (cursor) pagination helpers. A cursor is the last row's sort key —
// (timestamp, id) — base64url-encoded for opaque, URL-safe transport. Keyset
// beats OFFSET at scale: O(log n) seek instead of scanning + discarding rows.

export interface Cursor {
  ts: string; // ISO timestamp of the last row (the primary sort key)
  id: string; // tiebreaker for rows sharing a timestamp
}

export function encodeCursor(c: Cursor): string {
  return Buffer.from(`${c.ts}|${c.id}`).toString("base64url");
}

// Tolerant decode — returns null for missing/garbage input rather than throwing,
// so a tampered cursor degrades to "first page" instead of a 500.
export function decodeCursor(raw: string | null | undefined): Cursor | null {
  if (!raw) return null;
  try {
    const decoded = Buffer.from(raw, "base64url").toString("utf8");
    const sep = decoded.indexOf("|");
    if (sep < 0) return null;
    const ts = decoded.slice(0, sep);
    const id = decoded.slice(sep + 1);
    if (!ts || !id) return null;
    return { ts, id };
  } catch {
    return null;
  }
}

// Parse + bound a `limit` query param.
export function clampLimit(raw: string | null | undefined, def = 100, max = 500): number {
  const n = Number(raw ?? def);
  if (!Number.isFinite(n)) return def;
  return Math.min(Math.max(Math.trunc(n), 1), max);
}

// Build the PostgREST .or() predicate for "rows after this cursor" under a
// DESCENDING (ts, id) sort: ts < cursor.ts OR (ts = cursor.ts AND id < cursor.id).
export function keysetFilter(tsColumn: string, idColumn: string, c: Cursor): string {
  return `${tsColumn}.lt.${c.ts},and(${tsColumn}.eq.${c.ts},${idColumn}.lt.${c.id})`;
}
