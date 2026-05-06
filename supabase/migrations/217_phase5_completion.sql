-- Phase 5 completion: org timezone, product_event_log entity columns

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS timezone text NULL;

COMMENT ON COLUMN public.organizations.timezone IS 'IANA timezone override for org (Phase 5 resolver order: org.timezone → organization_settings → digest_settings → UTC).';

ALTER TABLE public.product_event_log
  ADD COLUMN IF NOT EXISTS entity_type text NULL,
  ADD COLUMN IF NOT EXISTS entity_id uuid NULL;

COMMENT ON COLUMN public.product_event_log.entity_type IS 'Optional entity kind for PRODUCT_EVENTS audit.';
COMMENT ON COLUMN public.product_event_log.entity_id IS 'Optional entity id (generic; issue_id still used for issues).';
