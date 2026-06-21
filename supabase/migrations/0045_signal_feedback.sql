-- 0045_signal_feedback.sql
-- Analyst feedback loop: one up/down vote per (signal, user) on whether the
-- extractor got a signal right. Aggregated feedback nudges confidence and is the
-- training data for tuning extraction. Org-scoped RLS. Idempotent.

CREATE TABLE IF NOT EXISTS signal_feedback (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  signal_id   uuid NOT NULL REFERENCES signals_raw(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id      uuid NULL,
  vote        text NOT NULL CHECK (vote IN ('up', 'down')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (signal_id, user_id)
);

CREATE INDEX IF NOT EXISTS signal_feedback_signal_idx ON signal_feedback(signal_id);

ALTER TABLE signal_feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org members view signal_feedback" ON signal_feedback;
CREATE POLICY "org members view signal_feedback" ON signal_feedback
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR org_id = (auth.jwt() -> 'app_metadata' ->> 'org_id')::uuid
  );

DROP POLICY IF EXISTS "users upsert own signal_feedback" ON signal_feedback;
CREATE POLICY "users upsert own signal_feedback" ON signal_feedback
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "users update own signal_feedback" ON signal_feedback;
CREATE POLICY "users update own signal_feedback" ON signal_feedback
  FOR UPDATE TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "users delete own signal_feedback" ON signal_feedback;
CREATE POLICY "users delete own signal_feedback" ON signal_feedback
  FOR DELETE TO authenticated USING (user_id = auth.uid());
