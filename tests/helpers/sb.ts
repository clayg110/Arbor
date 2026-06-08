import { vi } from "vitest";

// Minimal stand-in for a Supabase client used by route-handler tests. The query
// builder is fully chainable and thenable: `await sb.from(t).select().eq()` and
// `await sb.from(t).insert().select().single()` both resolve to the same
// configured result, so a route's exact call chain doesn't matter to the test.

export interface MockResult {
  data?: unknown;
  count?: number;
  error?: unknown;
}

const CHAIN = [
  "select",
  "insert",
  "update",
  "delete",
  "upsert",
  "eq",
  "neq",
  "in",
  "or",
  "ilike",
  "like",
  "match",
  "order",
  "range",
  "limit",
  "gte",
  "lte",
  "gt",
  "lt",
  "is",
  "not",
  "contains",
];

function makeQuery(result: MockResult) {
  const r: MockResult = { data: null, count: 0, error: null, ...result };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const q: any = {};
  for (const k of CHAIN) q[k] = vi.fn(() => q);
  q.single = vi.fn(() => Promise.resolve(r));
  q.maybeSingle = vi.fn(() => Promise.resolve(r));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  q.then = (res: (v: MockResult) => unknown, rej?: (e: unknown) => unknown) =>
    Promise.resolve(r).then(res, rej);
  return q;
}

export interface MockClientOpts {
  user?: unknown;
  result?: MockResult;
  rpc?: MockResult;
  // Methods exposed under `auth.admin.*` (listUsers, getUserById, updateUserById,
  // deleteUser, generateLink, createUser). Each test supplies only what it needs.
  admin?: Record<string, unknown>;
}

export function makeClient(opts: MockClientOpts = {}) {
  const result = opts.result ?? { data: [], count: 0, error: null };
  return {
    auth: {
      getUser: vi.fn(() =>
        Promise.resolve({ data: { user: opts.user ?? null }, error: null })
      ),
      admin: opts.admin ?? {},
    },
    from: vi.fn(() => makeQuery(result)),
    rpc: vi.fn(() => Promise.resolve(opts.rpc ?? { data: null, error: null })),
  };
}

// Route tests mock @/lib/supabase/server to read this slot, so each test can
// swap the active client in beforeEach without fighting vi.mock hoisting. The
// mock factory itself must be inlined per-file (it may only reference globalThis,
// not imports, because vi.mock is hoisted above imports):
//
//   vi.mock("@/lib/supabase/server", () => ({
//     hasSupabaseEnv: () => true,
//     createClient: async () => (globalThis as Record<string, unknown>).__sb,
//     createServiceClient: () => (globalThis as Record<string, unknown>).__sb,
//   }));
export function installClient(client: unknown): void {
  (globalThis as Record<string, unknown>).__sb = client;
}

export const fakeUser = {
  analyst: {
    id: "u-analyst",
    email: "analyst@arbor.test",
    user_metadata: { role: "analyst" },
    app_metadata: { org_id: "org-1" },
  },
  admin: {
    id: "u-admin",
    email: "admin@arbor.test",
    user_metadata: { role: "admin" },
    app_metadata: { org_id: "org-1" },
  },
};
