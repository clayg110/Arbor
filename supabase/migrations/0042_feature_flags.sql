-- 0042_feature_flags.sql
-- Kill switches / feature flags. A row turns a feature OFF (enabled=false);
-- absent table or row means the feature is ON, so code stays dormant-safe before
-- this migration is applied. Optional org_id scopes a flag to one tenant; a NULL
-- org_id row is the global default. Resolution (org override beats global) lives
-- in lib/flags.ts so it's pure + unit-tested.

-- Surrogate PK: org_id must stay NULLABLE (a NULL row is the global default), so
-- it can't be part of a primary key. Uniqueness is enforced by the two partial
-- indexes below instead.
CREATE TABLE feature_flags (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key         text NOT NULL CHECK (char_length(key) BETWEEN 1 AND 100),
  org_id      uuid NULL,
  enabled     boolean NOT NULL DEFAULT true,
  description text NULL CHECK (description IS NULL OR char_length(description) <= 500),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  updated_by  uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL
);

-- At most one global row per key (plain UNIQUE wouldn't dedupe NULL org_ids).
CREATE UNIQUE INDEX feature_flags_global_idx
  ON feature_flags (key)
  WHERE org_id IS NULL;

-- At most one row per (key, org).
CREATE UNIQUE INDEX feature_flags_org_idx
  ON feature_flags (key, org_id)
  WHERE org_id IS NOT NULL;

ALTER TABLE feature_flags ENABLE ROW LEVEL SECURITY;

-- Readable by any authenticated user (so the app can reflect flag state); writes
-- go through the service client (admin tooling), which bypasses RLS.
CREATE POLICY "authenticated read feature_flags" ON feature_flags FOR SELECT TO authenticated
  USING (
    org_id IS NULL
    OR org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid
  );
