-- Add delivered_at for ops override "Mark delivered" (status DELIVERED)
ALTER TABLE notification_outbox
  ADD COLUMN IF NOT EXISTS delivered_at timestamptz NULL;
