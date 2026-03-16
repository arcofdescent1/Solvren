-- Task 11: Draft vs Submit lifecycle
-- Add ready_at; ensure status supports DRAFT, READY, IN_REVIEW, APPROVED, REJECTED.
-- (status is text, no enum constraint; we use these values in application logic.)

ALTER TABLE public.change_events
  ADD COLUMN IF NOT EXISTS ready_at timestamptz NULL;

COMMENT ON COLUMN public.change_events.ready_at IS 'When readiness checks last passed (status=READY or prior to IN_REVIEW)';
