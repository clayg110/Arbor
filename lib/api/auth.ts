import type { SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import type { Database } from "@/types/db";
import { createClient } from "@/lib/supabase/server";
import { fail } from "@/lib/api/respond";

export interface SessionUser {
  id: string;
  email: string;
  role: string;
  orgId: string | null;
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
    orgId: (user.app_metadata?.org_id as string) ?? null,
  };
}

// Shared admin gate for route handlers. `res` set → return it; otherwise `user`
// is the authenticated admin.
export async function requireAdmin(): Promise<
  { res: NextResponse; user: null } | { res: null; user: SessionUser }
> {
  const user = await getSessionUser(createClient());
  if (!user) return { res: fail("Unauthorized", 401), user: null };
  if (user.role !== "admin") return { res: fail("Forbidden", 403), user: null };
  return { res: null, user };
}
