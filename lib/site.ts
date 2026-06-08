// Single source of truth for site identity — used by metadata, sitemap, robots,
// manifest, and the OG image. NEXT_PUBLIC_APP_URL pins the canonical origin in
// production; falls back to localhost in dev.

export const SITE = {
  name: "Arbor",
  tagline: "PE deal-lifecycle intelligence",
  description:
    "Live intelligence on companies moving through private-equity deal lifecycles — carve-outs and private-asset exits tracked in real time.",
  url: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
} as const;

export const COMPANY = {
  legalName: "Arbor Intelligence, Inc.",
  contactEmail: "privacy@arbor.example",
} as const;

// Last-updated stamp for the legal pages. Bump when the documents change.
export const LEGAL_UPDATED = "June 7, 2026";
