import { type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ok, fail, requireBackend, serverError } from "@/lib/api/respond";
import { getSessionUser } from "@/lib/api/auth";

// DELETE /api/companies/[id]/bids/[bidId]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; bidId: string }> }
) {
  const guard = requireBackend();
  if (guard) return guard;
  const { bidId } = await params;
  const supabase = await createClient();
  const user = await getSessionUser(supabase);
  if (!user) return fail("Unauthorized", 401);

  const { error } = await supabase
    .from("deal_bids")
    .delete()
    .eq("id", bidId)
    .eq("user_id", user.id);

  if (error) return serverError(error);
  return ok({ ok: true });
}
