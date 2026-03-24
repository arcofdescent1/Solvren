-- SSO implementation design (§2–§9)
-- Adds email_domains, default_role, expires_at; expands provider_type; backfills from domain_hint

-- 1. Add email_domains jsonb to sso_providers
ALTER TABLE public.sso_providers
  ADD COLUMN IF NOT EXISTS email_domains jsonb DEFAULT '[]'::jsonb;

-- Backfill from domain_hint where present
UPDATE public.sso_providers
SET email_domains = jsonb_build_array(lower(trim(domain_hint)))
WHERE domain_hint IS NOT NULL AND trim(domain_hint) != ''
  AND (email_domains IS NULL OR email_domains = '[]'::jsonb);

-- 2. Add default_role (fallback when no mapping matches)
ALTER TABLE public.sso_providers
  ADD COLUMN IF NOT EXISTS default_role text DEFAULT 'viewer'
  CHECK (default_role IN ('owner','admin','reviewer','submitter','approver','viewer'));

-- 3. Add expires_at to sso_auth_sessions for TTL cleanup
ALTER TABLE public.sso_auth_sessions
  ADD COLUMN IF NOT EXISTS expires_at timestamptz;

-- Set default: 10 minutes from creation
UPDATE public.sso_auth_sessions
SET expires_at = created_at + interval '10 minutes'
WHERE expires_at IS NULL;

ALTER TABLE public.sso_auth_sessions
  ALTER COLUMN expires_at SET DEFAULT (now() + interval '10 minutes');

-- 4. Expand provider_type to include google_workspace, entra
ALTER TABLE public.sso_providers
  DROP CONSTRAINT IF EXISTS sso_providers_provider_type_check;

ALTER TABLE public.sso_providers
  ADD CONSTRAINT sso_providers_provider_type_check
  CHECK (provider_type IN (
    'okta','google','google_workspace','azure_ad','entra',
    'ping','oidc_custom','saml_custom'
  ));

-- 5. Create function to clean expired sso_auth_sessions
CREATE OR REPLACE FUNCTION public.cleanup_expired_sso_auth_sessions()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count integer;
BEGIN
  DELETE FROM public.sso_auth_sessions
  WHERE expires_at IS NOT NULL AND expires_at < now();
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

COMMENT ON FUNCTION public.cleanup_expired_sso_auth_sessions() IS
  'Removes expired SSO auth sessions. Call from cron or after each SSO start.';
