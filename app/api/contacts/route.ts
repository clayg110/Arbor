import { type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { ok, fail, requireBackend, serverError } from "@/lib/api/respond";
import { getSessionUser } from "@/lib/api/auth";
import { parseJson, optionalContactEmail, optionalContactUrl } from "@/lib/validation";
import { toContact } from "@/lib/adapters";
import type { DbContact } from "@/types/db";

const createSchema = z.object({
  name: z.string().trim().min(1).max(200),
  title: z.string().trim().max(200).nullish(),
  firm: z.string().trim().max(200).nullish(),
  email: optionalContactEmail,
  phone: z.string().trim().max(50).nullish(),
  linkedinUrl: optionalContactUrl,
  notes: z.string().trim().max(2000).nullish(),
});

// GET /api/contacts?firm=&q=  — org contact directory.
export async function GET(req: NextRequest) {
  const guard = requireBackend();
  if (guard) return guard;
  const supabase = await createClient();
  const user = await getSessionUser(supabase);
  if (!user) return fail("Unauthorized", 401);

  const firm = req.nextUrl.searchParams.get("firm");
  const q = req.nextUrl.searchParams.get("q");

  let query = supabase.from("contacts").select("*").order("name", { ascending: true });
  if (firm) query = query.eq("firm", firm);
  if (q) query = query.ilike("name", `%${q}%`);

  const { data, error } = await query;
  if (error) return serverError(error);

  return ok({ contacts: ((data ?? []) as DbContact[]).map(toContact) });
}

// POST /api/contacts — create a contact in the directory.
export async function POST(req: NextRequest) {
  const guard = requireBackend();
  if (guard) return guard;
  const supabase = await createClient();
  const user = await getSessionUser(supabase);
  if (!user) return fail("Unauthorized", 401);

  const parsed = await parseJson(req, createSchema);
  if (!parsed.ok) return parsed.res;
  const d = parsed.data;

  const { data, error } = await supabase
    .from("contacts")
    .insert({
      org_id: user.orgId ?? null,
      created_by: user.id,
      name: d.name,
      title: d.title ?? null,
      firm: d.firm ?? null,
      email: d.email ?? null,
      phone: d.phone ?? null,
      linkedin_url: d.linkedinUrl ?? null,
      notes: d.notes ?? null,
    })
    .select("*")
    .single();
  if (error) return serverError(error);

  return ok({ contact: toContact(data as DbContact) }, { status: 201 });
}
