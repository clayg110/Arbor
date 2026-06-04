// Bigram Dice coefficient — deterministic 0..1 name similarity for entity
// resolution (no dependency on Typesense's opaque text_match scoring).

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/\b(inc|corp|corporation|llc|ltd|plc|sa|co|group|holdings|the)\b/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function dice(a: string, b: string): number {
  const x = normalize(a);
  const y = normalize(b);
  if (!x || !y) return 0;
  if (x === y) return 1;
  if (x.length < 2 || y.length < 2) return x === y ? 1 : 0;

  const bigrams = (s: string) => {
    const m = new Map<string, number>();
    for (let i = 0; i < s.length - 1; i++) {
      const g = s.slice(i, i + 2);
      m.set(g, (m.get(g) ?? 0) + 1);
    }
    return m;
  };

  const A = bigrams(x);
  const B = bigrams(y);
  let intersection = 0;
  let total = 0;
  A.forEach((c, g) => {
    total += c;
    const bc = B.get(g);
    if (bc) intersection += Math.min(c, bc);
  });
  B.forEach((c) => {
    total += c;
  });
  return (2 * intersection) / total;
}
