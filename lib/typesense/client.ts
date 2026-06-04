import Typesense from "typesense";

export const COMPANIES_COLLECTION = "companies";

export function hasTypesenseEnv(): boolean {
  return !!process.env.TYPESENSE_HOST && !!process.env.TYPESENSE_API_KEY;
}

// Server-only Typesense client. Accepts a bare host; infers port/protocol
// (localhost → 8108/http, otherwise 443/https). Override with TYPESENSE_PORT /
// TYPESENSE_PROTOCOL.
export function typesenseClient() {
  const host = process.env.TYPESENSE_HOST!;
  const local = host.includes("localhost") || host.startsWith("127.");
  return new Typesense.Client({
    nodes: [
      {
        host,
        port: Number(process.env.TYPESENSE_PORT ?? (local ? 8108 : 443)),
        protocol: process.env.TYPESENSE_PROTOCOL ?? (local ? "http" : "https"),
      },
    ],
    apiKey: process.env.TYPESENSE_API_KEY!,
    connectionTimeoutSeconds: 5,
  });
}

// Index schema for the companies collection (mirrored in scripts/sync-typesense.mjs).
export const COMPANIES_SCHEMA = {
  name: COMPANIES_COLLECTION,
  fields: [
    { name: "name", type: "string" },
    { name: "sector", type: "string", facet: true },
    { name: "deal_type", type: "string", facet: true },
    { name: "sponsor_firm", type: "string", optional: true },
    { name: "parent_company", type: "string", optional: true },
    { name: "current_stage", type: "string", facet: true },
    { name: "confidence", type: "string", facet: true },
  ],
} as const;

// Document stored per company.
export interface CompanyDoc {
  id: string;
  name: string;
  sector: string;
  deal_type: string;
  sponsor_firm?: string;
  parent_company?: string;
  current_stage: string;
  confidence: string;
}
