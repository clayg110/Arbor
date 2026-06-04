// Sync companies from Supabase → Typesense.
// Run:  node --env-file=.env.local scripts/sync-typesense.mjs
// Requires: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
//           TYPESENSE_HOST, TYPESENSE_API_KEY (+ optional TYPESENSE_PORT/PROTOCOL)

import { createClient } from "@supabase/supabase-js";
import Typesense from "typesense";

const COLLECTION = "companies";

const SCHEMA = {
  name: COLLECTION,
  fields: [
    { name: "name", type: "string" },
    { name: "sector", type: "string", facet: true },
    { name: "deal_type", type: "string", facet: true },
    { name: "sponsor_firm", type: "string", optional: true },
    { name: "parent_company", type: "string", optional: true },
    { name: "current_stage", type: "string", facet: true },
    { name: "confidence", type: "string", facet: true },
  ],
};

function need(name) {
  const v = process.env[name];
  if (!v) {
    console.error(`Missing env ${name}`);
    process.exit(1);
  }
  return v;
}

const supabase = createClient(
  need("NEXT_PUBLIC_SUPABASE_URL"),
  need("SUPABASE_SERVICE_ROLE_KEY"),
  { auth: { persistSession: false } }
);

const host = need("TYPESENSE_HOST");
const local = host.includes("localhost") || host.startsWith("127.");
const ts = new Typesense.Client({
  nodes: [
    {
      host,
      port: Number(process.env.TYPESENSE_PORT ?? (local ? 8108 : 443)),
      protocol: process.env.TYPESENSE_PROTOCOL ?? (local ? "http" : "https"),
    },
  ],
  apiKey: need("TYPESENSE_API_KEY"),
  connectionTimeoutSeconds: 10,
});

async function ensureCollection() {
  try {
    await ts.collections(COLLECTION).retrieve();
    console.log(`Collection "${COLLECTION}" exists.`);
  } catch {
    await ts.collections().create(SCHEMA);
    console.log(`Created collection "${COLLECTION}".`);
  }
}

async function* fetchCompanies(pageSize = 1000) {
  let from = 0;
  for (;;) {
    const { data, error } = await supabase
      .from("companies")
      .select("id,name,sector,deal_type,sponsor_firm,parent_company,current_stage,confidence")
      .range(from, from + pageSize - 1);
    if (error) throw error;
    if (!data || data.length === 0) return;
    yield data;
    if (data.length < pageSize) return;
    from += pageSize;
  }
}

async function main() {
  await ensureCollection();
  let total = 0;
  for await (const batch of fetchCompanies()) {
    const docs = batch.map((c) => ({
      id: c.id,
      name: c.name,
      sector: c.sector,
      deal_type: c.deal_type,
      sponsor_firm: c.sponsor_firm ?? undefined,
      parent_company: c.parent_company ?? undefined,
      current_stage: c.current_stage,
      confidence: c.confidence,
    }));
    await ts.collections(COLLECTION).documents().import(docs, { action: "upsert" });
    total += docs.length;
    console.log(`Indexed ${total}…`);
  }
  console.log(`Done. ${total} companies indexed in Typesense.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
