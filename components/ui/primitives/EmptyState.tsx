import { cn } from "@/lib/format";

// Centered empty-state block: optional icon, a title, supporting hint, and an
// optional action (e.g. a Button/Link). Replaces bare "No X found." lines on
// full-page empty views so a blank list reads as intentional, not broken.

export function EmptyState({
  icon,
  title,
  hint,
  action,
  className,
}: {
  icon?: React.ReactNode;
  title: string;
  hint?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center px-6 py-16 text-center",
        className
      )}
    >
      {icon && <div className="mb-3 text-subtle">{icon}</div>}
      <p className="text-[13px] font-medium text-ink">{title}</p>
      {hint && <p className="mt-1 max-w-xs text-[12px] text-muted">{hint}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
