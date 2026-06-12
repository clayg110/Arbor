// DB fund rows → frontend shape. Pure — no Supabase imports.

import type { DbFund } from "@/types/db";
import type { LpFund } from "@/lib/lp-report";

export function toFund(row: DbFund): LpFund {
  return {
    id: row.id,
    name: row.name,
    vintageYear: row.vintage_year,
  };
}
