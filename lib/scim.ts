// SCIM 2.0 pure helpers — resource mapping, filter parsing, response envelopes.
// The DB/auth side lives in the route handlers. Implements the Users subset that
// Okta/Azure AD exercise (list+filter, create, get, PATCH active, delete).

export const SCIM_USER_SCHEMA = "urn:ietf:params:scim:schemas:core:2.0:User";
export const SCIM_LIST_SCHEMA = "urn:ietf:params:scim:api:messages:2.0:ListResponse";
export const SCIM_ERROR_SCHEMA = "urn:ietf:params:scim:api:messages:2.0:Error";

export interface ScimUserInput {
  id: string;
  email?: string | null;
  name?: string | null;
  active: boolean;
}

export function toScimUser(u: ScimUserInput) {
  return {
    schemas: [SCIM_USER_SCHEMA],
    id: u.id,
    userName: u.email ?? "",
    name: { formatted: u.name ?? u.email ?? "" },
    emails: u.email ? [{ value: u.email, primary: true }] : [],
    active: u.active,
    meta: { resourceType: "User" },
  };
}

// Extract the email from a SCIM `userName eq "x"` filter (IdPs query this before
// creating a user). Returns null when absent/unsupported.
export function parseUserNameFilter(filter: string | null | undefined): string | null {
  if (!filter) return null;
  const m = filter.match(/userName\s+eq\s+"([^"]+)"/i);
  return m ? m[1]!.trim().toLowerCase() : null;
}

export function scimList(resources: unknown[], total: number, startIndex = 1) {
  return {
    schemas: [SCIM_LIST_SCHEMA],
    totalResults: total,
    startIndex,
    itemsPerPage: resources.length,
    Resources: resources,
  };
}

export function scimError(status: number, detail: string) {
  return { schemas: [SCIM_ERROR_SCHEMA], status: String(status), detail };
}

function toBool(v: unknown): boolean {
  if (typeof v === "string") return v.toLowerCase() === "true";
  return Boolean(v);
}

interface ScimPatch {
  Operations?: { op?: string; path?: string; value?: unknown }[];
}

// Read the desired `active` state from a PATCH body. Handles both
// {path:"active", value:false} and {value:{active:false}}, and IdPs that send the
// value as a string. Returns null when the patch doesn't touch `active`.
export function patchActive(body: ScimPatch): boolean | null {
  for (const op of body.Operations ?? []) {
    if ((op.op ?? "").toLowerCase() !== "replace" && (op.op ?? "") !== "") continue;
    if ((op.path ?? "").toLowerCase() === "active") return toBool(op.value);
    if (op.value && typeof op.value === "object" && "active" in op.value) {
      return toBool((op.value as { active: unknown }).active);
    }
  }
  return null;
}
