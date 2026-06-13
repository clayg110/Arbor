// Pure ranking for radar sorts the database can't order on. Conviction is a
// weighted formula computed in app code (lib/conviction.ts), and confidence is
// an enum we rank by transaction-likelihood, not alphabetically — neither maps
// to a single sortable column. So these "computed" sorts must rank the full
// filtered set and paginate AFTER ranking; sorting only a DB page would
// mis-order results across pages (the bug this replaces).

import type { RadarCompany } from "@/lib/radar-data";
import type { Confidence } from "@/lib/types";

// Upper bound on rows pulled for a computed sort. Below this the full filtered
// set is ranked exactly; above it, denormalize the conviction score onto
// `companies` and sort at the DB instead (see CLAUDE.md remaining-work).
export const COMPUTED_SORT_CAP = 1000;

const CONF_RANK: Record<Confidence, number> = {
  high: 4,
  medium: 3,
  low: 2,
  needs_review: 1,
};

const COMPUTED_SORTS = new Set(["conv_desc", "conv_asc", "conf_desc", "conf_asc"]);

// True when the sort key is computed in app code and cannot be ordered by the DB.
export function isComputedSort(sort: string): boolean {
  return COMPUTED_SORTS.has(sort);
}

// Rank `radar` by the computed key, then slice to the requested page. Expects
// the full (capped) filtered set, not a single DB page. V8's sort is stable, so
// ties preserve input order (the DB's secondary ordering, e.g. name).
export function rankComputed(
  radar: RadarCompany[],
  sort: string,
  offset: number,
  limit: number
): RadarCompany[] {
  const ranked = [...radar];
  if (sort === "conf_desc" || sort === "conf_asc") {
    ranked.sort((a, b) => {
      const d = CONF_RANK[b.confidence] - CONF_RANK[a.confidence];
      return sort === "conf_desc" ? d : -d;
    });
  } else if (sort === "conv_desc" || sort === "conv_asc") {
    ranked.sort((a, b) => {
      const d = (b.conviction?.score ?? 0) - (a.conviction?.score ?? 0);
      return sort === "conv_desc" ? d : -d;
    });
  }
  return ranked.slice(offset, offset + limit);
}
