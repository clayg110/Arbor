import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/types/db";

// Public paths (no auth required). /landing is the marketing page, /legal holds
// the terms + privacy pages, and the crawler/metadata routes must be reachable
// without a session.
const PUBLIC = [
  "/login",
  "/signup",
  "/forgot-password",
  "/auth",
  "/landing",
  "/legal",
  "/status",
  "/robots.txt",
  "/sitemap.xml",
  "/manifest.webmanifest",
  "/opengraph-image",
];

export async function updateSession(request: NextRequest) {
  // Mock mode: no Supabase env → skip auth entirely so the app stays usable.
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    return NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isPublic = PUBLIC.some((p) => path === p || path.startsWith(p + "/"));

  // Unauthenticated. API routes get a clean 401 JSON (so client fetchers fall
  // back to mock instead of parsing a login HTML redirect); pages redirect.
  // Root path redirects to the marketing landing page instead of login.
  if (!user && !isPublic) {
    if (path.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const url = request.nextUrl.clone();
    if (path === "/") {
      url.pathname = "/landing.html";
      url.search = "";
    } else {
      url.pathname = "/login";
      url.searchParams.set("redirectTo", path);
    }
    return NextResponse.redirect(url);
  }

  // Admin-only areas.
  if (user && path.startsWith("/admin")) {
    const role = (user.user_metadata?.role as string) ?? "analyst";
    if (role !== "admin") {
      const url = request.nextUrl.clone();
      url.pathname = "/radar";
      return NextResponse.redirect(url);
    }
  }

  return response;
}
