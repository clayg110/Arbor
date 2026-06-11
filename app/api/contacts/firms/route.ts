import { createClient } from "@/lib/supabase/server";
import { ok, fail, requireBackend, serverError } from "@/lib/api/respond";
import { getSessionUser } from "@/lib/api/auth";
import { bankerIntelligence } from "@/lib/contacts";
import type { ContactRole } from "@/lib/contacts";
import type { DbCompanyContact, DbContact } from "@/types/db";

// GET /api/contacts/firms — banker intelligence: M&A-advisor firms ranked by
// how many of the team's processes they're engaged on.
export async function GET() {
  const guard = requireBackend();
  if (guard) return guard;
  const supabase = await createClient();
  const user = await getSessionUser(supabase);
  if (!user) return fail("Unauthorized", 401);

  const { data: links, error: linkErr } = await supabase
    .from("company_contacts")
    .select("company_id, contact_id, role");
  if (linkErr) return serverError(linkErr);

  const linkRows = (links ?? []) as Pick<
    DbCompanyContact,
    "company_id" | "contact_id" | "role"
  >[];
  const contactIds = [...new Set(linkRows.map((l) => l.contact_id))];

  const firmByContact = new Map<string, string | null>();
  if (contactIds.length > 0) {
    const { data: cs, error: cErr } = await supabase
      .from("contacts")
      .select("id, firm")
      .in("id", contactIds);
    if (cErr) return serverError(cErr);
    for (const c of (cs ?? []) as Pick<DbContact, "id" | "firm">[]) {
      firmByContact.set(c.id, c.firm);
    }
  }

  const firms = bankerIntelligence(
    linkRows.map((l) => ({
      companyId: l.company_id,
      firm: firmByContact.get(l.contact_id) ?? null,
      role: l.role as ContactRole,
    }))
  );

  return ok({ firms });
}
