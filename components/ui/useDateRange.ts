"use client";

import { useState } from "react";
import { rangeDates, type Preset } from "@/lib/analytics-data";

export interface CommittedRange {
  preset: Preset;
  from: string;
  to: string;
}

// Shared date-range state for the feed sidebar + analytics control bar.
// Non-custom presets commit immediately; "custom" commits only on Apply.
export function useDateRange(
  initial?: CommittedRange,
  onCommit?: (c: CommittedRange) => void
) {
  const startPreset = initial?.preset ?? "week";
  const customDefault = rangeDates("custom");

  const [selected, setSelected] = useState<Preset>(startPreset);
  const [from, setFrom] = useState(initial?.from ?? customDefault.from);
  const [to, setTo] = useState(initial?.to ?? customDefault.to);
  const [committed, setCommitted] = useState<CommittedRange>(() =>
    initial?.preset === "custom"
      ? { preset: "custom", from: initial.from, to: initial.to }
      : { preset: startPreset, ...rangeDates(startPreset) }
  );

  function commit(c: CommittedRange) {
    setCommitted(c);
    onCommit?.(c);
  }

  function selectPreset(p: Preset) {
    setSelected(p);
    if (p !== "custom") commit({ preset: p, ...rangeDates(p) });
  }

  function apply() {
    commit({ preset: "custom", from, to });
  }

  return { selected, from, to, setFrom, setTo, committed, selectPreset, apply };
}
