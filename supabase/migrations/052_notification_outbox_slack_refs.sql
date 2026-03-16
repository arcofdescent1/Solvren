-- Patch 1B.2 — Store Slack message reference on notification_outbox for updating message after approve/reject

alter table public.notification_outbox
  add column if not exists slack_channel_id text null,
  add column if not exists slack_message_ts text null,
  add column if not exists slack_team_id text null;

create index if not exists idx_notification_outbox_slack_ts on public.notification_outbox(slack_message_ts);
