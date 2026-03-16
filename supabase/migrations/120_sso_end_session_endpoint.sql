-- Optional OIDC end_session_endpoint for IdP logout redirect
alter table public.sso_providers
  add column if not exists end_session_endpoint text;
