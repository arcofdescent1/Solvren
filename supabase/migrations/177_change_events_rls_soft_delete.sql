-- Phase 1 production: RLS on change_events + hide soft-deleted rows from authenticated sessions.
-- Service role continues to bypass RLS for jobs/webhooks.

ALTER TABLE public.change_events ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE pol text;
BEGIN
  FOR pol IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'change_events'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.change_events', pol);
  END LOOP;
END $$;

-- Authenticated: only active (non-tombstone) rows visible for normal product use.
CREATE POLICY change_events_select_active_org ON public.change_events
  FOR SELECT TO authenticated
  USING (
    public.is_org_member(org_id)
    AND deleted_at IS NULL
  );

CREATE POLICY change_events_insert_org ON public.change_events
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_org_member(org_id)
    AND deleted_at IS NULL
  );

-- Allow updates while row is active; WITH CHECK allows setting deleted_at (soft delete).
CREATE POLICY change_events_update_org ON public.change_events
  FOR UPDATE TO authenticated
  USING (
    public.is_org_member(org_id)
    AND deleted_at IS NULL
  )
  WITH CHECK (public.is_org_member(org_id));

-- Deletes reserved for service role / maintenance (no authenticated DELETE policy).

COMMENT ON POLICY change_events_select_active_org ON public.change_events IS
  'Phase 1: members cannot read soft-deleted changes via SSR client.';
