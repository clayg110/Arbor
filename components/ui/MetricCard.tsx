import { ArrowUpIcon, ArrowDownIcon } from "./icons";

export function MetricCard({
  label,
  value,
  delta,
}: {
  label: string;
  value: string;
  delta?: { direction: "up" | "down"; text: string; good?: boolean };
}) {
  // Color: by default up = green, down = red, but `good` can override
  // (e.g. "deals pulled" down is good but the spec shows it red, so we keep
  // direction-based coloring and let callers express intent via `good`).
  const positive = delta
    ? delta.good ?? delta.direction === "up"
    : false;
  const color = positive ? "#27500A" : "#791F1F";

  return (
    <div className="rounded-lg bg-[#F5F4EF] p-4">
      <div className="text-[11px] font-normal text-muted">{label}</div>
      <div className="mt-1 text-[20px] font-medium leading-tight text-ink">
        {value}
      </div>
      {delta && (
        <div
          className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium"
          style={{ color }}
        >
          {delta.direction === "up" ? (
            <ArrowUpIcon className="h-3 w-3" />
          ) : (
            <ArrowDownIcon className="h-3 w-3" />
          )}
          {delta.text}
        </div>
      )}
    </div>
  );
}
