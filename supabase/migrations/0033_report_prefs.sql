-- Add report_frequency to user_preferences so users can opt into
-- weekly or monthly pipeline report emails (dormant without RESEND_API_KEY).
ALTER TABLE user_preferences
  ADD COLUMN IF NOT EXISTS report_frequency text NOT NULL DEFAULT 'off'
    CHECK (report_frequency IN ('off', 'weekly', 'monthly'));
