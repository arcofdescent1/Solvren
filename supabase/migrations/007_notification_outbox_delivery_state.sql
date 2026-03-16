-- Phase 3.1: Make notification outbox durable and retryable

-- Add delivery state columns to notification_outbox
ALTER TABLE notification_outbox
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'PENDING',
  ADD COLUMN IF NOT EXISTS attempt_count int DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_error text,
  ADD COLUMN IF NOT EXISTS available_at timestamptz DEFAULT now();

-- Backfill existing unsent rows
UPDATE notification_outbox
SET status = 'PENDING', attempt_count = 0
WHERE sent_at IS NULL AND (status IS NULL OR status = '');

UPDATE notification_outbox
SET status = 'SENT'
WHERE sent_at IS NOT NULL AND (status IS NULL OR status = '');

-- Index for fast polling
CREATE INDEX IF NOT EXISTS idx_notification_outbox_pending
  ON notification_outbox(status, available_at)
  WHERE status = 'PENDING';

-- Add last_notified_at to change_events for throttle
ALTER TABLE change_events ADD COLUMN IF NOT EXISTS last_notified_at timestamptz;
