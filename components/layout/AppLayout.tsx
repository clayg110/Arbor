"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/format";

const NAV = [
  { href: "/radar", label: "Radar" },
  { href: "/feed", label: "Feed" },
  { href: "/analytics", label: "Analytics" },
];

export function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen">
      <header
        className="sticky top-0 z-20 bg-surface/90 backdrop-blur"
        style={{ borderBottom: "0.5px solid var(--border)" }}
      >
        <div className="mx-auto grid h-14 max-w-[1320px] grid-cols-[1fr_auto_1fr] items-center px-6">
          {/* wordmark */}
          <Link href="/radar" className="justify-self-start text-[15px] font-medium tracking-tight text-ink">
            Arbor
          </Link>

          {/* center nav */}
          <nav className="flex items-center gap-1 justify-self-center">
            {NAV.map((item) => {
              const active =
                pathname === item.href || pathname.startsWith(item.href + "/");
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "relative px-3 py-1.5 text-[13px] font-medium transition-colors",
                    active ? "text-ink" : "text-muted hover:text-ink"
                  )}
                >
                  {item.label}
                  {active && (
                    <span
                      className="absolute inset-x-3 -bottom-[11px] h-[2px] rounded-full"
                      style={{ backgroundColor: "#185FA5" }}
                    />
                  )}
                </Link>
              );
            })}
          </nav>

          {/* user */}
          <div className="justify-self-end">
            <div
              className="flex h-8 w-8 items-center justify-center rounded-full bg-[#F1EFE8] text-[11px] font-medium text-[#444441]"
              title="Priya Nair"
            >
              PN
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1320px] px-6 py-7">{children}</div>
    </div>
  );
}
