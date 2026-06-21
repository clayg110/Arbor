import { type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { ok, fail, requireBackend, serverError } from "@/lib/api/respond";
import { getSessionUser } from "@/lib/api/auth";
import { parseJson } from "@/lib/validation";
import {
  extractFinancials,
  hasAnyFinancials,
  isDocumentKind,
  type DealDocument,
} from "@/lib/documents";
import type { DbDocument } from "@/types/db";

function toDocument(row: DbDocument): DealDocument {
  return {
    id: row.id,
    companyId: row.company_id,
    name: row.name,
    kind: row.kind,
    storagePath: row.storage_path,
    contentType: row.content_type,
    sizeBytes: row.size_bytes,
    extracted: row.extracted,
    createdAt: row.created_at,
  };
}

const postSchema = z.object({
  name: z.string().trim().min(1).max(300),
  kind: z.enum(["teaser", "cim", "financials", "other"]),
  storagePath: z.string().trim().max(500).nullable().default(null),
  contentType: z.string().trim().max(120).nullable().default(null),
  sizeBytes: z.number().int().nonnegative().nullable().default(null),
  // Optional plain text of the document — when supplied we auto-extract stated
  // financials from it (no server-side PDF parsing today).
  text: z.string().max(500_000).optional(),
});

// GET /api/companies/[id]/documents
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

  const { data, error } = await supabase
    .from("documents")
    .select("*")
    .eq("company_id", id)
    .order("created_at", { ascending: false });

  if (error) return serverError(error);
  return ok({ documents: ((data ?? []) as DbDocument[]).map(toDocument) });
}

// POST /api/companies/[id]/documents — record an uploaded document + auto-extract.
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

  const parsed = await parseJson(req, postSchema);
  if (!parsed.ok) return parsed.res;
  const { name, kind, storagePath, contentType, sizeBytes, text } = parsed.data;

  const extracted = text && text.trim() ? extractFinancials(text) : null;

  const { data, error } = await supabase
    .from("documents")
    .insert({
      company_id: id,
      created_by: user.id,
      org_id: user.orgId ?? null,
      name,
      kind: isDocumentKind(kind) ? kind : "other",
      storage_path: storagePath,
      content_type: contentType,
      size_bytes: sizeBytes,
      extracted: extracted && hasAnyFinancials(extracted) ? extracted : null,
    })
    .select()
    .single();

  if (error) return serverError(error);
  return ok({ document: toDocument(data as DbDocument) });
}

// DELETE /api/companies/[id]/documents?docId=...
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = requireBackend();
  if (guard) return guard;
  const { id } = await params;
  const docId = req.nextUrl.searchParams.get("docId");
  if (!docId) return fail("docId required", 400);

  const supabase = await createClient();
  const user = await getSessionUser(supabase);
  if (!user) return fail("Unauthorized", 401);

  const { error } = await supabase
    .from("documents")
    .delete()
    .eq("id", docId)
    .eq("company_id", id);

  if (error) return serverError(error);
  return ok({ ok: true });
}
