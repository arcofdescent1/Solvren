-- Dashboard indexes for revenue exposure queries
-- (Columns + enum already exist from 046, 061, 088)
CREATE INDEX IF NOT EXISTS idx_change_events_org_submitted
  ON public.change_events(org_id, submitted_at DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_change_events_org_surface
  ON public.change_events(org_id, revenue_surface);

CREATE INDEX IF NOT EXISTS idx_change_events_org_status
  ON public.change_events(org_id, status);
