// Backfill company logos for existing rows that have no logo_url.
// Uses Clearbit's free autocomplete endpoint (name → domain + logo). Off the
// ingestion hot path — run manually after seeding or migrating.
// Run:  node --env-file=.env.local scripts/backfill-logos.mjs
// Requires: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

import { createClient } from "@supabase/supabase-js";

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

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchLogoUrl(name) {
  const q = name.trim();
  if (!q) return null;
  try {
    const res = await fetch(
      `https://autocomplete.clearbit.com/v1/companies/suggest?query=${encodeURIComponent(q)}`,
      { signal: AbortSignal.timeout(5000) }
    );
    if (!res.ok) return null;
    const list = await res.json();
    const hit = Array.isArray(list) ? list[0] : null;
    if (!hit) return null;
    return hit.logo || (hit.domain ? `https://logo.clearbit.com/${hit.domain}` : null);
  } catch {
    return null;
  }
}

async function main() {
  const { data, error } = await supabase
    .from("companies")
    .select("id,name")
    .is("logo_url", null);
  if (error) throw error;

  const rows = data ?? [];
  console.log(`${rows.length} companies without a logo.`);

  let found = 0;
  for (const c of rows) {
    const url = await fetchLogoUrl(c.name);
    if (url) {
      const { error: upErr } = await supabase
        .from("companies")
        .update({ logo_url: url })
        .eq("id", c.id);
      if (upErr) {
        console.error(`  ${c.name}: update failed — ${upErr.message}`);
      } else {
        found++;
        console.log(`  ${c.name} → ${url}`);
      }
    }
    await sleep(150); // be gentle with the public endpoint
  }

  console.log(`Done. ${found}/${rows.length} logos set.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
