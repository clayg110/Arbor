"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { GlobalSearch } from "@/components/ui/GlobalSearch";
import { cn } from "@/lib/format";

const NAV = [
  { href: "/radar", label: "Radar" },
  { href: "/feed", label: "Feed" },
  { href: "/analytics", label: "Analytics" },
  { href: "/watchlist", label: "Watchlist" },
];

export interface SessionUser {
  email: string;
  role: string;
}

function initialsOf(email: string): string {
  const name = email.split("@")[0] ?? "";
  const parts = name.split(/[.\-_]/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || name.slice(0, 2).toUpperCase() || "?";
}

export function AppLayout({
  children,
  user = null,
}: {
  children: React.ReactNode;
  user?: SessionUser | null;
}) {
  const pathname = usePathname();
  const router = useRouter();

  // Auth pages: no app chrome.
  const AUTH_PATHS = ["/login", "/signup", "/forgot-password", "/auth/reset"];
  if (AUTH_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return <div className="min-h-screen">{children}</div>;
  }

  const nav = [...NAV];
  if (user?.role === "admin") nav.push({ href: "/admin", label: "Admin" });

  async function signOut() {
    await createClient().auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="min-h-screen">
      <header
        className="sticky top-0 z-20 bg-surface/90 backdrop-blur"
        style={{ borderBottom: "0.5px solid var(--border)" }}
      >
        <div className="mx-auto grid h-14 max-w-[1320px] grid-cols-[1fr_auto_1fr] items-center px-6">
          <Link href="/radar" className="justify-self-start text-[15px] font-medium tracking-tight text-ink">
            Arbor
          </Link>

          <nav className="flex items-center gap-1 justify-self-center">
            {nav.map((item) => {
              const active = pathname === item.href || pathname.startsWith(item.href + "/");
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
                    <span className="absolute inset-x-3 -bottom-[11px] h-[2px] rounded-full" style={{ backgroundColor: "#185FA5" }} />
                  )}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-3 justify-self-end">
            <div className="hidden md:block">
              <GlobalSearch />
            </div>
            {user ? (
              <>
                <div className="hidden text-right sm:block">
                  <div className="text-[12px] font-medium leading-tight text-ink">{user.email}</div>
                  <div className="text-[10px] font-normal uppercase tracking-wide text-subtle">{user.role}</div>
                </div>
                <div
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-[#F1EFE8] text-[11px] font-medium text-[#444441]"
                  title={user.email}
                >
                  {initialsOf(user.email)}
                </div>
                <button
                  type="button"
                  onClick={signOut}
                  className="rounded-md px-2.5 py-1 text-[12px] font-medium text-muted hover:text-ink"
                  style={{ border: "0.5px solid var(--border)" }}
                >
                  Sign out
                </button>
              </>
            ) : (
              <div
                className="flex h-8 w-8 items-center justify-center rounded-full bg-[#F1EFE8] text-[11px] font-medium text-[#444441]"
                title="Demo"
              >
                PN
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1320px] px-6 py-7">{children}</div>
    </div>
  );
}
