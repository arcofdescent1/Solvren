-- Add delivered_count to notification_outbox for IN_APP fan-out / SLACK+EMAIL single delivery
ALTER TABLE notification_outbox
  ADD COLUMN IF NOT EXISTS delivered_count int NULL;
