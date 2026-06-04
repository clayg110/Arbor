// Entity resolution: fuzzy-match an extracted company name to an existing
// record. Typesense for candidate recall (if configured), else Supabase ilike;
// Dice coefficient for scoring. Match only above 0.85.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/db";
import { dice } from "./similarity";
import {
  hasTypesenseEnv,
  typesenseClient,
  COMPANIES_COLLECTION,
  type CompanyDoc,
} from "@/lib/typesense/client";

const THRESHOLD = 0.85;

type Svc = SupabaseClient<Database>;

export async function resolveCompany(
  svc: Svc,
  name: string | undefined
): Promise<{ id: string; score: number } | null> {
  if (!name?.trim()) return null;

  let candidates: { id: string; name: string }[] = [];

  if (hasTypesenseEnv()) {
    try {
      const res = await typesenseClient()
        .collections(COMPANIES_COLLECTION)
        .documents()
        .search({ q: name, query_by: "name", per_page: 5 });
      candidates = (res.hits ?? []).map((h) => {
        const d = h.document as CompanyDoc;
        return { id: d.id, name: d.name };
      });
    } catch {
      candidates = [];
    }
  }

  if (candidates.length === 0) {
    const first = name.split(/\s+/)[0];
    const { data } = await svc
      .from("companies")
      .select("id,name")
      .ilike("name", `%${first}%`)
      .limit(10);
    candidates = (data ?? []).map((c) => ({ id: c.id, name: c.name }));
  }

  let best: { id: string; score: number } | null = null;
  for (const c of candidates) {
    const score = dice(name, c.name);
    if (!best || score > best.score) best = { id: c.id, score };
  }

  return best && best.score >= THRESHOLD ? best : null;
}
