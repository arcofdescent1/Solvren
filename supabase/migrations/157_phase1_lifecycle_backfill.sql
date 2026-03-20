-- Phase 1 — Backfill existing issues with lifecycle state and synthetic events
-- Maps legacy status to lifecycle state; creates synthetic ISSUE_DETECTED events.
-- Does not set CLOSED (requires terminal classification); leaves verified/dismissed as VERIFIED_SUCCESS/NO_ACTION_TAKEN.

DO $backfill$
DECLARE
  r RECORD;
  target_state text;
  ev_count int;
BEGIN
  FOR r IN
    SELECT i.id, i.org_id, i.status, i.lifecycle_state, i.lifecycle_version
    FROM public.issues i
    WHERE i.lifecycle_state = 'DETECTED' OR i.lifecycle_state IS NULL
  LOOP
    target_state := CASE r.status
      WHEN 'open' THEN 'DETECTED'
      WHEN 'triaged' THEN 'IMPACT_ESTIMATED'
      WHEN 'assigned' THEN 'IMPACT_ESTIMATED'
      WHEN 'in_progress' THEN 'ACTION_PLANNED'
      WHEN 'resolved' THEN 'VERIFICATION_PENDING'
      WHEN 'verified' THEN 'VERIFIED_SUCCESS'
      WHEN 'dismissed' THEN 'NO_ACTION_TAKEN'
      ELSE 'DETECTED'
    END;

    UPDATE public.issues
    SET lifecycle_state = target_state,
        lifecycle_version = COALESCE(lifecycle_version, 1)
    WHERE id = r.id;

    SELECT count(*) INTO ev_count
    FROM public.issue_lifecycle_events
    WHERE issue_id = r.id;

    IF ev_count = 0 THEN
      INSERT INTO public.issue_lifecycle_events (
        org_id, issue_id, event_type, from_state, to_state,
        event_reason, actor_type
      ) VALUES (
        r.org_id, r.id, 'ISSUE_DETECTED', NULL, target_state,
        'migration_backfill', 'system'
      );
    END IF;
  END LOOP;
END $backfill$;
