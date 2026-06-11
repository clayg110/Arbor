-- Saved radar filter sets per user (named bookmarks for the radar page).
CREATE TABLE saved_views (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id      uuid NULL,
  name        text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 100),
  filters     jsonb NOT NULL DEFAULT '{}',
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX saved_views_user_idx ON saved_views(user_id);

ALTER TABLE saved_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users manage own views" ON saved_views FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
