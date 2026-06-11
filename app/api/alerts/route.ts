import { type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { ok, fail, requireBackend, serverError } from "@/lib/api/respond";
import { getSessionUser } from "@/lib/api/auth";
import {
  parseJson,
  sectorEnum,
  dealTypeEnum,
  stageEnum,
  confidenceEnum,
} from "@/lib/validation";
import { toAlertRule } from "@/lib/alert-rules";
import type { DbAlertRule } from "@/types/db";

export const dynamic = "force-dynamic";

const predicateSchema = z
  .object({
    sector: sectorEnum.optional(),
    dealType: dealTypeEnum.optional(),
    sponsorContains: z.string().trim().max(120).optional(),
    nameContains: z.string().trim().max(120).optional(),
    stageEnters: stageEnum.optional(),
    minConfidence: confidenceEnum.optional(),
    minConviction: z.number().int().min(0).max(100).optional(),
  })
  .strict();

const createSchema = z.object({
  name: z.string().trim().min(1).max(120),
  predicate: predicateSchema.default({}),
  webhook: z.boolean().default(false),
  emailDelivery: z.boolean().default(false),
});

const patchSchema = z.object({
  id: z.string().uuid(),
  active: z.boolean().optional(),
  name: z.string().trim().min(1).max(120).optional(),
});

// GET /api/alerts — the signed-in user's alert rules (RLS-scoped).
export async function GET() {
  const guard = requireBackend();
  if (guard) return guard;
  const sb = await createClient();
  const user = await getSessionUser(sb);
  if (!user) return fail("Unauthorized", 401);

  const { data, error } = await sb
    .from("alert_rules")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) return serverError(error);
  return ok({ rules: ((data ?? []) as DbAlertRule[]).map(toAlertRule) });
}

// POST /api/alerts — create a rule.
export async function POST(request: NextRequest) {
  const guard = requireBackend();
  if (guard) return guard;
  const sb = await createClient();
  const user = await getSessionUser(sb);
  if (!user) return fail("Unauthorized", 401);

  const parsed = await parseJson(request, createSchema);
  if (!parsed.ok) return parsed.res;
  const { name, predicate, webhook, emailDelivery } = parsed.data;

  const { data, error } = await sb
    .from("alert_rules")
    .insert({
      user_id: user.id,
      org_id: user.orgId,
      name,
      predicate,
      webhook,
      email_delivery: emailDelivery,
    })
    .select("*")
    .single();
  if (error) return serverError(error);
  return ok({ rule: toAlertRule(data as DbAlertRule) }, { status: 201 });
}

// PATCH /api/alerts — toggle active / rename (own rules only, enforced by RLS).
export async function PATCH(request: NextRequest) {
  const guard = requireBackend();
  if (guard) return guard;
  const sb = await createClient();
  const user = await getSessionUser(sb);
  if (!user) return fail("Unauthorized", 401);

  const parsed = await parseJson(request, patchSchema);
  if (!parsed.ok) return parsed.res;
  const { id, ...rest } = parsed.data;
  const update: Partial<DbAlertRule> = {};
  if (rest.active !== undefined) update.active = rest.active;
  if (rest.name !== undefined) update.name = rest.name;

  if (Object.keys(update).length === 0) return fail("No fields to update", 400);

  const { error } = await sb
    .from("alert_rules")
    .update(update)
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) return serverError(error);
  return ok({ ok: true });
}

// DELETE /api/alerts?id= — remove a rule.
export async function DELETE(request: NextRequest) {
  const guard = requireBackend();
  if (guard) return guard;
  const sb = await createClient();
  const user = await getSessionUser(sb);
  if (!user) return fail("Unauthorized", 401);

  const id = new URL(request.url).searchParams.get("id");
  if (!id) return fail("id required");
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!UUID_RE.test(id)) return fail("id must be a valid UUID", 400);
  const { error } = await sb
    .from("alert_rules")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) return serverError(error);
  return ok({ ok: true });
}
