-- 1B Pass 1 — Store Slack thread context on change for direct-post approval flow

ALTER TABLE public.change_events
  ADD COLUMN IF NOT EXISTS slack_channel_id text NULL,
  ADD COLUMN IF NOT EXISTS slack_message_ts text NULL;

CREATE INDEX IF NOT EXISTS idx_change_events_slack_thread
  ON public.change_events(org_id, slack_channel_id)
  WHERE slack_channel_id IS NOT NULL;
