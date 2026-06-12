// Pure mention utilities: handle derivation, extraction from text, and
// resolution to user IDs. Shared by the outreach POST route (server-side
// notification dispatch) and the member-autocomplete endpoint.

export interface OrgMember {
  id: string;
  name: string;
  handle: string;
}

/** Derive a stable @handle from a display name (no spaces, lowercase). */
export function nameToHandle(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9._-]/g, "");
}

/** Extract unique lowercase @handles from note text. */
export function extractMentionHandles(text: string): string[] {
  const seen = new Set<string>();
  const re = /@([A-Za-z][A-Za-z0-9._-]{0,49})/g;
  let m;
  while ((m = re.exec(text)) !== null) seen.add(m[1]!.toLowerCase());
  return [...seen];
}

/**
 * Resolve handles to matching member IDs.
 * Skips the author (no self-notification) and unresolved handles.
 */
export function resolveHandles(
  handles: string[],
  members: OrgMember[],
  authorId: string
): string[] {
  return handles
    .map((h) => members.find((m) => m.handle === h)?.id)
    .filter((id): id is string => !!id && id !== authorId);
}
