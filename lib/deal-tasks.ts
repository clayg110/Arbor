// Pure helpers for deal tasks. No I/O.

export interface DealTask {
  id: string;
  companyId: string;
  userId: string;
  title: string;
  dueAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

export interface OutreachEntry {
  id: string;
  companyId: string;
  userId: string;
  authorName: string;
  type: "call" | "email" | "meeting" | "other";
  note: string;
  contactedAt: string;
  createdAt: string;
}

export const OUTREACH_TYPES: { value: OutreachEntry["type"]; label: string }[] = [
  { value: "call", label: "Call" },
  { value: "email", label: "Email" },
  { value: "meeting", label: "Meeting" },
  { value: "other", label: "Other" },
];

export function isOverdue(task: DealTask, now = new Date()): boolean {
  if (task.completedAt) return false;
  if (!task.dueAt) return false;
  return new Date(task.dueAt) < now;
}

export function isDueToday(task: DealTask, now = new Date()): boolean {
  if (task.completedAt || !task.dueAt) return false;
  const due = new Date(task.dueAt);
  return (
    due.getFullYear() === now.getFullYear() &&
    due.getMonth() === now.getMonth() &&
    due.getDate() === now.getDate()
  );
}

export function formatDue(dueAt: string | null, now = new Date()): string {
  if (!dueAt) return "";
  const due = new Date(dueAt);
  const diffMs = due.getTime() - now.getTime();
  const diffDays = Math.round(diffMs / 86_400_000);

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Tomorrow";
  if (diffDays === -1) return "Yesterday";
  if (diffDays < 0) return `${Math.abs(diffDays)}d overdue`;
  if (diffDays <= 7) return `In ${diffDays}d`;
  return due.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// Sorts tasks: incomplete first (overdue before future), then completed last.
export function sortTasks(tasks: DealTask[], now = new Date()): DealTask[] {
  return [...tasks].sort((a, b) => {
    const aDone = !!a.completedAt;
    const bDone = !!b.completedAt;
    if (aDone !== bDone) return aDone ? 1 : -1;
    // Both incomplete: sort overdue first, then by due date ascending, no-due last.
    const aOver = isOverdue(a, now);
    const bOver = isOverdue(b, now);
    if (aOver !== bOver) return aOver ? -1 : 1;
    if (a.dueAt && b.dueAt) return a.dueAt.localeCompare(b.dueAt);
    if (a.dueAt) return -1;
    if (b.dueAt) return 1;
    return a.createdAt.localeCompare(b.createdAt);
  });
}

// Parse @word mentions from note content. Returns unique names (lowercased).
export function parseMentions(content: string): string[] {
  const matches = content.match(/@([A-Za-z][A-Za-z0-9._-]{0,49})/g) ?? [];
  const names = matches.map((m) => m.slice(1).toLowerCase());
  return [...new Set(names)];
}
