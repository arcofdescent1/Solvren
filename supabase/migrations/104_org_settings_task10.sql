-- Task 10: Organization configuration (profile, notifications, approval defaults)
-- Add columns to organization_settings for org-wide config.

ALTER TABLE public.organization_settings
  ADD COLUMN IF NOT EXISTS timezone text NOT NULL DEFAULT 'UTC',
  ADD COLUMN IF NOT EXISTS primary_notification_email text NULL,
  ADD COLUMN IF NOT EXISTS default_review_sla_hours int NULL,
  ADD COLUMN IF NOT EXISTS require_evidence_before_approval boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS daily_inbox_enabled boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.organization_settings.timezone IS 'IANA timezone for digest/inbox timing and SLA interpretation';
COMMENT ON COLUMN public.organization_settings.primary_notification_email IS 'Primary contact email for org-level notifications';
COMMENT ON COLUMN public.organization_settings.default_review_sla_hours IS 'Default review SLA in hours (e.g. 48)';
COMMENT ON COLUMN public.organization_settings.require_evidence_before_approval IS 'Global default: require evidence before approval';
COMMENT ON COLUMN public.organization_settings.daily_inbox_enabled IS 'Whether daily inbox digest is enabled';
