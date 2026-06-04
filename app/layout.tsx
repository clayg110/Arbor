import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AppLayout, type SessionUser } from "@/components/layout/AppLayout";
import { createClient, hasSupabaseEnv } from "@/lib/supabase/server";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Arbor",
  description: "Live intelligence on companies moving through PE deal lifecycles.",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // Resolve session only when backend is configured; mock mode stays anonymous.
  let user: SessionUser | null = null;
  if (hasSupabaseEnv()) {
    try {
      const supabase = createClient();
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
        <AppLayout user={user}>{children}</AppLayout>
      </body>
    </html>
  );
}
