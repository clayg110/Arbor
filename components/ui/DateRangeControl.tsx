"use client";

import { PRESETS, type Preset } from "@/lib/analytics-data";
import { CalendarIcon } from "./icons";

export function DateRangeControl({
  selected,
  from,
  to,
  onSelect,
  onFromChange,
  onToChange,
  onApply,
  variant = "sidebar",
}: {
  selected: Preset;
  from: string;
  to: string;
  onSelect: (p: Preset) => void;
  onFromChange: (v: string) => void;
  onToChange: (v: string) => void;
  onApply: () => void;
  variant?: "sidebar" | "bar";
}) {
  const pillText = variant === "bar" ? "text-[12px]" : "text-[11px]";

  return (
    <div>
      <div className="flex flex-wrap gap-1">
        {PRESETS.map((p) => {
          const active = selected === p.v;
          return (
            <button
              key={p.v}
              type="button"
              onClick={() => onSelect(p.v)}
              className={`rounded-full px-2.5 py-1 font-medium transition-colors ${pillText}`}
              style={
                active
                  ? { backgroundColor: "#185FA5", color: "#fff" }
                  : { backgroundColor: "var(--surface)", color: "var(--text-muted)", boxShadow: "inset 0 0 0 0.5px var(--border)" }
              }
            >
              {p.label}
            </button>
          );
        })}
      </div>

      {selected === "custom" && (
        <div className={variant === "bar" ? "mt-2 flex items-end gap-2" : "mt-2"}>
          <div className={variant === "bar" ? "flex items-end gap-2" : "flex gap-2"}>
            <DateField label="From" value={from} onChange={onFromChange} />
            <DateField label="To" value={to} onChange={onToChange} />
          </div>
          <button
            type="button"
            onClick={onApply}
            className={`rounded-md px-3 py-1.5 text-[11px] font-medium text-white ${variant === "bar" ? "" : "mt-2 w-full"}`}
            style={{ backgroundColor: "#185FA5" }}
          >
            Apply
          </button>
        </div>
      )}

      {/* hide native date picker indicator; we render our own icon */}
      <style jsx global>{`
        .arbor-date::-webkit-calendar-picker-indicator {
          opacity: 0;
          position: absolute;
          right: 0;
          top: 0;
          width: 100%;
          height: 100%;
          cursor: pointer;
        }
      `}</style>
    </div>
  );
}

function DateField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-0.5 block text-[10px] font-normal text-subtle">{label}</span>
      <span
        className="relative flex items-center rounded-md bg-surface"
        style={{ border: "0.5px solid var(--border)" }}
      >
        <input
          type="date"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="arbor-date w-[120px] appearance-none bg-transparent px-2 py-1 pr-6 text-[11px] font-normal text-ink focus:outline-none"
        />
        <CalendarIcon className="pointer-events-none absolute right-1.5 h-3.5 w-3.5 text-subtle" />
      </span>
    </label>
  );
}
