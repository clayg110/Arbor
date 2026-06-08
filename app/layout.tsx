import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AppLayout, type SessionUser } from "@/components/layout/AppLayout";
import { CookieNotice } from "@/components/ui/CookieNotice";
import { createClient, hasSupabaseEnv } from "@/lib/supabase/server";
import { SITE } from "@/lib/site";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: { default: `${SITE.name} — ${SITE.tagline}`, template: `%s · ${SITE.name}` },
  description: SITE.description,
  applicationName: SITE.name,
  openGraph: {
    title: `${SITE.name} — ${SITE.tagline}`,
    description: SITE.description,
    url: SITE.url,
    siteName: SITE.name,
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE.name} — ${SITE.tagline}`,
    description: SITE.description,
  },
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // Resolve session only when backend is configured; mock mode stays anonymous.
  let user: SessionUser | null = null;
  if (hasSupabaseEnv()) {
    try {
      const supabase = await createClient();
      const {
        data: { user: u },
      } = await supabase.auth.getUser();
      if (u) {
        user = {
          email: u.email ?? "",
          role: (u.user_metadata?.role as string) ?? "analyst",
        };
      }
    } catch {
      user = null;
    }
  }

  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-screen bg-bg text-ink antialiased">
        <a
          href="#main"
          className="sr-only z-50 rounded-md bg-surface px-3 py-2 text-[13px] font-medium text-ink focus:not-sr-only focus:absolute focus:left-3 focus:top-3"
          style={{ border: "0.5px solid var(--border)" }}
        >
          Skip to content
        </a>
        <AppLayout user={user}>{children}</AppLayout>
        <CookieNotice />
      </body>
    </html>
  );
}
