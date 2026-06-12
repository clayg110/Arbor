import { type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { ok, fail, requireBackend, serverError } from "@/lib/api/respond";
import { getSessionUser } from "@/lib/api/auth";
import { parseJson } from "@/lib/validation";
import { PROCESS_STAGES } from "@/lib/process-stage";
import { isValidCalendarDate } from "@/lib/calendar";

// `date` must be a real calendar date (YYYY-MM-DD), and `stage` a known process
// stage — these land in companies.process_key_dates, which the calendar feed
// serializes, so garbage here would otherwise surface downstream.
const patchSchema = z.object({
  stage: z.enum(PROCESS_STAGES as [string, ...string[]]),
  date: z
    .string()
    .refine(isValidCalendarDate, "date must be a valid YYYY-MM-DD")
    .nullable(),
});

// PATCH /api/companies/[id]/process-stage/key-dates
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = requireBackend();
  if (guard) return guard;
  const { id } = await params;
  const supabase = await createClient();
  const user = await getSessionUser(supabase);
  if (!user) return fail("Unauthorized", 401);

  const parsed = await parseJson(req, patchSchema);
  if (!parsed.ok) return parsed.res;

  const { stage, date } = parsed.data;

  const { data: current, error: fetchError } = await supabase
    .from("companies")
    .select("process_key_dates")
    .eq("id", id)
    .single();
  if (fetchError) return serverError(fetchError);

  const keyDates: Record<string, string> = {
    ...((current as { process_key_dates: Record<string, string> | null })
      .process_key_dates ?? {}),
  };

  if (date === null) {
    delete keyDates[stage];
  } else {
    keyDates[stage] = date;
  }

  const { error: updateError } = await supabase
    .from("companies")
    .update({ process_key_dates: keyDates })
    .eq("id", id);
  if (updateError) return serverError(updateError);

  return ok({ keyDates });
}
