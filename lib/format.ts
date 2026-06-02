export function cn(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

export function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

// "TODAY" / "YESTERDAY" / "MON, MAY 31" — relative to the mock "today".
const TODAY = new Date("2026-06-02T12:00:00");

export function dayLabel(iso: string): string {
  const d = new Date(iso);
  const a = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const t = new Date(TODAY.getFullYear(), TODAY.getMonth(), TODAY.getDate());
  const diff = Math.round((t.getTime() - a.getTime()) / 86_400_000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

// "47 days" / "14 months" style age label.
export function daysLabel(days: number): string {
  if (days < 31) return `${days} ${days === 1 ? "day" : "days"} in stage`;
  const months = Math.round(days / 30);
  return `${months} ${months === 1 ? "month" : "months"} in stage`;
}
