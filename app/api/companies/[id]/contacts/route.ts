import { type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { ok, fail, requireBackend, serverError } from "@/lib/api/respond";
import { getSessionUser } from "@/lib/api/auth";
import { parseJson } from "@/lib/validation";
import { toCompanyContact } from "@/lib/adapters";
import { CONTACT_ROLES, suggestAdvisorsFromSignals } from "@/lib/contacts";
import type { ContactRole } from "@/lib/contacts";
import type { DbContact, DbCompanyContact, DbSignal } from "@/types/db";

const linkSchema = z
  .object({
    // Either link an existing contact…
    contactId: z.string().uuid().optional(),
    // …or create a new one inline.
    name: z.string().trim().min(1).max(200).optional(),
    title: z.string().trim().max(200).nullish(),
    firm: z.string().trim().max(200).nullish(),
    email: z.string().trim().max(320).nullish(),
    phone: z.string().trim().max(50).nullish(),
    linkedinUrl: z.string().trim().max(500).nullish(),
    role: z.enum(CONTACT_ROLES as [ContactRole, ...ContactRole[]]).default("Other"),
  })
  .refine((d) => d.contactId || d.name, {
    message: "contactId or name is required",
  });

// GET /api/companies/[id]/contacts — linked contacts + advisor suggestions.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = requireBackend();
  if (guard) return guard;
  const { id } = await params;
  const supabase = await createClient();
  const user = await getSessionUser(supabase);
  if (!user) return fail("Unauthorized", 401);

  const { data: links, error: linkErr } = await supabase
    .from("company_contacts")
    .select("*")
    .eq("company_id", id);
  if (linkErr) return serverError(linkErr);

  const linkRows = (links ?? []) as DbCompanyContact[];
  const contactIds = linkRows.map((l) => l.contact_id);

  let contactRows: DbContact[] = [];
  if (contactIds.length > 0) {
    const { data: cs, error: cErr } = await supabase
      .from("contacts")
      .select("*")
      .in("id", contactIds);
    if (cErr) return serverError(cErr);
    contactRows = (cs ?? []) as DbContact[];
  }
  const byId = new Map(contactRows.map((c) => [c.id, c]));

  const contacts = linkRows
    .map((l) => {
      const c = byId.get(l.contact_id);
      return c ? toCompanyContact(l, c) : null;
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .sort((a, b) => a.name.localeCompare(b.name));

  // Advisor suggestions from this company's signal excerpts (firms not yet linked).
  const { data: sigs } = await supabase
    .from("signals_raw")
    .select("*")
    .eq("company_id", id)
    .order("ingested_at", { ascending: false })
    .limit(20);
  const excerpts = ((sigs ?? []) as DbSignal[]).map(
    (s) => s.llm_output?.key_quote ?? s.raw_text ?? ""
  );
  const existingFirms = contacts.map((c) => c.firm ?? "").filter(Boolean);
  const suggestions = suggestAdvisorsFromSignals(excerpts, existingFirms);

  return ok({ contacts, suggestions });
}

// POST /api/companies/[id]/contacts — link an existing contact or create + link.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = requireBackend();
  if (guard) return guard;
  const { id } = await params;
  const supabase = await createClient();
  const user = await getSessionUser(supabase);
  if (!user) return fail("Unauthorized", 401);

  const parsed = await parseJson(req, linkSchema);
  if (!parsed.ok) return parsed.res;
  const d = parsed.data;

  let contactId = d.contactId ?? null;

  // Create the contact first when linking a brand-new person.
  if (!contactId) {
    const { data: created, error: createErr } = await supabase
      .from("contacts")
      .insert({
        org_id: user.orgId ?? null,
        created_by: user.id,
        name: d.name!,
        title: d.title ?? null,
        firm: d.firm ?? null,
        email: d.email ?? null,
        phone: d.phone ?? null,
        linkedin_url: d.linkedinUrl ?? null,
      })
      .select("*")
      .single();
    if (createErr) return serverError(createErr);
    contactId = (created as DbContact).id;
  }

  const { data: link, error: linkErr } = await supabase
    .from("company_contacts")
    .insert({
      company_id: id,
      contact_id: contactId,
      org_id: user.orgId ?? null,
      role: d.role,
    })
    .select("*")
    .single();
  if (linkErr) return serverError(linkErr);

  const { data: contact, error: cErr } = await supabase
    .from("contacts")
    .select("*")
    .eq("id", contactId)
    .single();
  if (cErr) return serverError(cErr);

  return ok(
    { contact: toCompanyContact(link as DbCompanyContact, contact as DbContact) },
    { status: 201 }
  );
}

// DELETE /api/companies/[id]/contacts?linkId=… — unlink (contact stays in directory).
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = requireBackend();
  if (guard) return guard;
  await params;
  const linkId = req.nextUrl.searchParams.get("linkId");
  if (!linkId) return fail("linkId required", 400);

  const supabase = await createClient();
  const user = await getSessionUser(supabase);
  if (!user) return fail("Unauthorized", 401);

  const { error } = await supabase.from("company_contacts").delete().eq("id", linkId);
  if (error) return serverError(error);

  return ok({ ok: true });
}
