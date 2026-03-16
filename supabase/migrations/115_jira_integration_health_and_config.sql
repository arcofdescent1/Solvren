-- Jira integration: health fields + config validation support
-- Add health/status fields to integration_connections

alter table public.integration_connections
  add column if not exists last_error text,
  add column if not exists last_success_at timestamptz,
  add column if not exists last_token_refresh_at timestamptz,
  add column if not exists health_status text check (health_status in ('healthy', 'degraded', 'error'));

create index if not exists idx_integration_connections_health
  on public.integration_connections(org_id, health_status) where health_status is not null;
