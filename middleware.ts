import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  // Skip Next internals, static assets, cron ingestion routes (CRON_SECRET) and
  // the public API (api/v1 — self-guards with a bearer API key).
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/ingest|api/v1|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|html)$).*)",
  ],
};
