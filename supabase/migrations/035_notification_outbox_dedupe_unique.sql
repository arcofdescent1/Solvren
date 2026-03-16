-- Idempotent tick: one row per dedupe_key so SLA tick is safe to run often
create unique index if not exists notification_outbox_dedupe_unique
  on public.notification_outbox(dedupe_key)
  where dedupe_key is not null;
