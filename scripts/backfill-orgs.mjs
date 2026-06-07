// Provision multi-tenancy for an existing single-tenant deployment:
//   1. create (or reuse) a default org
//   2. set every auth user's app_metadata.org_id to it
//   3. stamp existing analyst_notes / watchlist rows with that org
// Idempotent. Run:  node --env-file=.env.local scripts/backfill-orgs.mjs
// Requires: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
// Optional: DEFAULT_ORG_NAME (default "Default Org")

import { createClient } from "@supabase/supabase-js";

function need(name) {
  const v = process.env[name];
  if (!v) {
    console.error(`Missing env ${name}`);
    process.exit(1);
  }
  return v;
}

const svc = createClient(need("NEXT_PUBLIC_SUPABASE_URL"), need("SUPABASE_SERVICE_ROLE_KEY"), {
  auth: { persistSession: false },
});

const ORG_NAME = process.env.DEFAULT_ORG_NAME ?? "Default Org";

async function getOrCreateOrg() {
  const { data: existing } = await svc.from("orgs").select("id").eq("name", ORG_NAME).maybeSingle();
  if (existing) return existing.id;
  const { data, error } = await svc.from("orgs").insert({ name: ORG_NAME }).select("id").single();
  if (error) throw error;
  return data.id;
}

async function assignUsers(orgId) {
  let page = 1;
  let total = 0;
  for (;;) {
    const { data, error } = await svc.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const users = data.users ?? [];
    if (users.length === 0) break;
    for (const u of users) {
      if (u.app_metadata?.org_id === orgId) continue;
      const { error: upErr } = await svc.auth.admin.updateUserById(u.id, {
        app_metadata: { ...(u.app_metadata ?? {}), org_id: orgId },
      });
      if (upErr) console.error(`  user ${u.email}: ${upErr.message}`);
      else total++;
    }
    if (users.length < 1000) break;
    page++;
  }
  console.log(`Assigned ${total} users to org.`);
}

async function stampRows(table, orgId) {
  const { error, count } = await svc
    .from(table)
    .update({ org_id: orgId }, { count: "exact" })
    .is("org_id", null);
  if (error) throw error;
  console.log(`Stamped ${count ?? 0} ${table} rows.`);
}

async function main() {
  const orgId = await getOrCreateOrg();
  console.log(`Org "${ORG_NAME}" → ${orgId}`);
  await assignUsers(orgId);
  await stampRows("analyst_notes", orgId);
  await stampRows("watchlist", orgId);
  console.log("Done. Users must re-login for the new JWT (org_id) to take effect.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
