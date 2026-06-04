import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/db";

export interface SessionUser {
  id: string;
  email: string;
  role: string;
}

export async function getSessionUser(
  sb: SupabaseClient<Database>
): Promise<SessionUser | null> {
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return null;
  return {
    id: user.id,
    email: user.email ?? "",
    role: (user.user_metadata?.role as string) ?? "analyst",
  };
}
