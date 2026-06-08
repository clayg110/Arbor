import Link from "next/link";
import { SITE } from "@/lib/site";

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-bg">
      <header
        style={{ borderBottom: "0.5px solid var(--border)" }}
        className="bg-surface"
      >
        <div className="mx-auto flex h-14 max-w-[760px] items-center justify-between px-6">
          <Link href="/" className="text-[15px] font-medium tracking-tight text-ink">
            {SITE.name}
          </Link>
          <nav className="flex items-center gap-4 text-[13px] text-muted">
            <Link href="/legal/terms" className="hover:text-ink">
              Terms
            </Link>
            <Link href="/legal/privacy" className="hover:text-ink">
              Privacy
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-[760px] px-6 py-12">{children}</main>
    </div>
  );
}
