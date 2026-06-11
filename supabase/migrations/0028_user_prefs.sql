-- User preferences: digest frequency and other per-user settings.
-- Upserted by the preferences API; empty row = all defaults.

CREATE TABLE user_preferences (
  user_id           uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  briefing_frequency text NOT NULL DEFAULT 'off'
    CHECK (briefing_frequency IN ('off', 'daily', 'weekly')),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users manage own prefs"
  ON user_preferences FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
