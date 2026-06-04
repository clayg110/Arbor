import { NextResponse, type NextRequest } from "next/server";
import { hasSupabaseEnv } from "@/lib/supabase/server";
import { hasAnthropicEnv } from "@/lib/extract-signal";

// Shared guard for ingestion routes: CRON_SECRET (when set) + required env.
export function cronGuard(request: NextRequest): NextResponse | null {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }
  if (!hasSupabaseEnv() || !hasAnthropicEnv()) {
    return NextResponse.json(
      { error: "Ingestion requires Supabase + Anthropic env" },
      { status: 503 }
    );
  }
  return null;
}
