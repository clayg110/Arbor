-- Add per-rule email delivery flag. When true, the notify cron sends a
-- Resend email on every match (dormant without RESEND_API_KEY).
ALTER TABLE alert_rules
  ADD COLUMN IF NOT EXISTS email_delivery boolean NOT NULL DEFAULT false;
