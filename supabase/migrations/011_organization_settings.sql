-- Org notification settings (Slack webhook, email, etc.)

CREATE TABLE IF NOT EXISTS public.organization_settings (
  org_id uuid PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
  slack_webhook_url text NULL,
  email_enabled boolean NOT NULL DEFAULT false,
  slack_enabled boolean NOT NULL DEFAULT false,
  notification_emails text[] NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.touch_org_settings_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  new.updated_at = now();
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS trg_org_settings_updated ON public.organization_settings;
CREATE TRIGGER trg_org_settings_updated
BEFORE UPDATE ON public.organization_settings
FOR EACH ROW EXECUTE FUNCTION public.touch_org_settings_updated_at();

ALTER TABLE organization_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS org_settings_select ON organization_settings;
CREATE POLICY org_settings_select ON organization_settings
FOR SELECT USING (is_org_member(org_id));

DROP POLICY IF EXISTS org_settings_insert ON organization_settings;
CREATE POLICY org_settings_insert ON organization_settings
FOR INSERT WITH CHECK (is_org_member(org_id));

DROP POLICY IF EXISTS org_settings_update ON organization_settings;
CREATE POLICY org_settings_update ON organization_settings
FOR UPDATE USING (is_org_member(org_id)) WITH CHECK (is_org_member(org_id));
