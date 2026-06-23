"use client";

import { useEffect, useRef, useState } from "react";

// Animates the numeric portion of an already-formatted string from 0 to target
// on mount — "$1.2B", "73%", "1,234" all count up while their prefix/suffix and
// decimal precision are preserved. Strings with no number render unchanged.
//
// `display === null` means "not animating" → the real target renders (so SSR and
// the first client render agree — no hydration mismatch — and no-JS still shows
// the value). The count only kicks in after mount when motion is allowed; a
// missing matchMedia (jsdom/SSR) or prefers-reduced-motion both skip it, which
// also keeps unit tests and reduced-motion e2e deterministic.

const PARTS = /^(\D*)(\d[\d,]*(?:\.\d+)?)(\D*)$/;

function prefersReducedMotion(): boolean {
  return (
    typeof window === "undefined" ||
    typeof window.matchMedia !== "function" ||
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export function CountUp({ value, duration = 900 }: { value: string; duration?: number }) {
  const match = value.match(PARTS);
  const prefix = match?.[1] ?? "";
  const numStr = match?.[2] ?? "";
  const suffix = match?.[3] ?? "";
  const target = numStr ? parseFloat(numStr.replace(/,/g, "")) : NaN;
  const decimals = numStr.includes(".") ? (numStr.split(".")[1]?.length ?? 0) : 0;
  const grouped = numStr.includes(",");

  const [display, setDisplay] = useState<number | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (Number.isNaN(target) || prefersReducedMotion()) return;
    setDisplay(0);
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
      setDisplay(target * eased);
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
      else setDisplay(null); // settle on the exact formatted target
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [target, duration]);

  if (Number.isNaN(target) || display === null) return <>{value}</>;

  const formatted = display.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
    useGrouping: grouped,
  });

  return (
    <>
      {prefix}
      {formatted}
      {suffix}
    </>
  );
}
