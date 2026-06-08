// Pure time/label helpers. Real `now()` (seed uses now()-Nd, so consistent).

const DAY = 86_400_000;

export function daysSince(iso: string): number {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return 0;
  return Math.max(0, Math.floor((Date.now() - t) / DAY));
}

// "47 days in stage" / "8 months in stage"
export function stageDaysLabel(days: number): string {
  if (days < 31) return `${days} ${days === 1 ? "day" : "days"} in stage`;
  const m = Math.round(days / 30);
  return `${m} ${m === 1 ? "month" : "months"} in stage`;
}

// "2 days ago" / "3 weeks ago" / "2 months ago"
export function relativeLabel(iso: string): string {
  const d = daysSince(iso);
  if (d <= 0) return "today";
  if (d === 1) return "1 day ago";
  if (d < 14) return `${d} days ago`;
  if (d < 60) return `${Math.round(d / 7)} weeks ago`;
  if (d < 365) return `${Math.round(d / 30)} months ago`;
  return `${Math.round(d / 365)} years ago`;
}

// "Today" / "Yesterday" / "Mon, 2 Jun 2026"
export function dayBucketLabel(iso: string): string {
  const d = new Date(iso);
  const a = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const now = new Date();
  const t = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diff = Math.round((t.getTime() - a.getTime()) / DAY);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// "Mar 15 2026"
export function shortDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d
    .toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    .replace(",", "");
}

// "2026-06-03" (date key for grouping)
export function dateKey(iso: string): string {
  return new Date(iso).toISOString().slice(0, 10);
}

export function initialsOf(name: string | null | undefined): string {
  if (!name) return "—";
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "—";
}
