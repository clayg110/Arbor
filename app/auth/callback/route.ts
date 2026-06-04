import { NextResponse, type NextRequest } from "next/server";
import { createClient, hasSupabaseEnv } from "@/lib/supabase/server";

// OAuth/email code exchange — handles email confirmation + password recovery.
// Email links point here with ?code=…(&next=…); we set the session cookie then
// redirect on.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/radar";

  if (code && hasSupabaseEnv()) {
    const supabase = createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${next}`);
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback`);
}
