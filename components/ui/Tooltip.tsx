"use client";

import { useState } from "react";

// Lightweight hover tooltip (no portal, no deps). Positioned above the trigger.
export function Tooltip({
  text,
  children,
  width = 220,
}: {
  text: string;
  children: React.ReactNode;
  width?: number;
}) {
  const [show, setShow] = useState(false);
  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      {children}
      {show && (
        <span
          className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-1.5 -translate-x-1/2 rounded-md px-2.5 py-1.5 text-[11px] font-normal leading-snug text-white"
          style={{ width, backgroundColor: "#1A1A18" }}
        >
          {text}
        </span>
      )}
    </span>
  );
}
