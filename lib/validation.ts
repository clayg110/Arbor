import { z } from "zod";
import type { NextResponse } from "next/server";
import { fail } from "@/lib/api/respond";
import { SECTORS } from "@/lib/colors";

// Parse + validate a JSON request body against a zod schema. Returns a typed
// payload or a ready-to-return 400 with field-level messages.
export async function parseJson<T extends z.ZodTypeAny>(
  request: Request,
  schema: T
): Promise<{ ok: true; data: z.infer<T> } | { ok: false; res: NextResponse }> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return { ok: false, res: fail("Invalid JSON body") };
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    const msg = parsed.error.issues
      .map((i) => `${i.path.join(".") || "body"}: ${i.message}`)
      .join("; ");
    return { ok: false, res: fail(msg) };
  }
  return { ok: true, data: parsed.data };
}

// ---- shared enums (mirror the DB) ----
export const sectorEnum = z.enum(SECTORS as unknown as [string, ...string[]]);
export const dealTypeEnum = z.enum(["carveout", "private_asset"]);
export const stageEnum = z.enum(["in_market", "monitor_for_exit", "on_hold", "pulled"]);
export const confidenceEnum = z.enum(["high", "medium", "low", "needs_review"]);
export const roleEnum = z.enum(["analyst", "admin"]);
