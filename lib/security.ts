import { timingSafeEqual } from "crypto";

// Constant-time string comparison for secrets (CRON_SECRET, tokens). A plain
// `a === b` short-circuits on the first differing byte, leaking length/prefix
// timing an attacker can exploit. This always compares the full buffers.
export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  // Different lengths can't be equal; comparing same-length dummies keeps the
  // work roughly constant without revealing the secret's length via early return.
  if (ab.length !== bb.length) {
    timingSafeEqual(ab, ab);
    return false;
  }
  return timingSafeEqual(ab, bb);
}
