-- Dedupe + throttle for notification outbox

ALTER TABLE notification_outbox
  ADD COLUMN IF NOT EXISTS dedupe_key text NULL;

CREATE INDEX IF NOT EXISTS notification_outbox_dedupe_idx
  ON notification_outbox(dedupe_key, created_at)
  WHERE dedupe_key IS NOT NULL;
