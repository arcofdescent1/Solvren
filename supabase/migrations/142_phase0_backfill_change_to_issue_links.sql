-- Phase 0: Backfill issue records for eligible changes/incidents only.
-- Policy: do not create noise; backfill only active or strategically important records.
-- This migration creates a sequence for issue_key and backfills a minimal set:
-- - No automatic backfill of historical data; run backfill jobs separately if desired.
-- - Ensure issue_key sequence exists per org for new issues.

-- Function to generate next issue_key for an org (e.g. ISS-000001)
CREATE OR REPLACE FUNCTION public.next_issue_key(p_org_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  next_num integer;
BEGIN
  SELECT COALESCE(MAX(
    NULLIF(REGEXP_REPLACE(issue_key, '^[^0-9]+', ''), '')::integer
  ), 0) + 1
  INTO next_num
  FROM public.issues
  WHERE org_id = p_org_id
    AND issue_key ~ '^ISS-[0-9]+$';
  RETURN 'ISS-' || LPAD(next_num::text, 6, '0');
END;
$$;

COMMENT ON FUNCTION public.next_issue_key(uuid) IS 'Phase 0: generate next human-readable issue key per org (ISS-000001, ISS-000002, ...)';

GRANT EXECUTE ON FUNCTION public.next_issue_key(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.next_issue_key(uuid) TO service_role;
