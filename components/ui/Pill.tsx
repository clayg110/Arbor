import type { ReactNode, CSSProperties } from "react";

// Flat pill used by every badge. Inline colors keep the exact hex values.
export function Pill({
  bg,
  text,
  border,
  children,
  style,
}: {
  bg: string;
  text: string;
  border?: string;
  children: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium leading-none"
      style={{
        backgroundColor: bg,
        color: text,
        ...(border ? { boxShadow: `inset 0 0 0 0.5px ${border}` } : undefined),
        ...style,
      }}
    >
      {children}
    </span>
  );
}
