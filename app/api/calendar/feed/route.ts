import { createClient } from "@/lib/supabase/server";
import { ok, fail, requireBackend } from "@/lib/api/respond";
import { getSessionUser } from "@/lib/api/auth";
import { hasCalendarEnv, makeCalendarToken } from "@/lib/calendar-token";
import { SITE } from "@/lib/site";

// GET /api/calendar/feed — the signed subscription URL for the current user.
// Settings shows it with a copy button; the user pastes it into Google/Outlook/
// Apple "add calendar from URL". Returns enabled:false when the feed is dormant
// (no CALENDAR_FEED_SECRET) so the UI can explain rather than hand out a dead URL.
export async function GET() {
  const guard = requireBackend();
  if (guard) return guard;

  const supabase = await createClient();
  const user = await getSessionUser(supabase);
  if (!user) return fail("Unauthorized", 401);

  if (!hasCalendarEnv()) return ok({ enabled: false, url: null });

  const token = makeCalendarToken(user.id);
  const url = `${SITE.url}/api/calendar/${token}.ics`;
  return ok({ enabled: true, url });
}
