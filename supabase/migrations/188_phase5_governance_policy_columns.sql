-- Phase 5 — Governance: platform vs org ownership and relaxation semantics on canonical policies.

alter table public.policies
  add column if not exists policy_owner_type text not null default 'ORG'
    check (policy_owner_type in ('PLATFORM', 'ORG'));

alter table public.policies
  add column if not exists relaxation_mode text not null default 'RELAXABLE'
    check (relaxation_mode in ('RELAXABLE', 'NON_RELAXABLE'));

comment on column public.policies.policy_owner_type is 'PLATFORM = tenant-wide mandatory; ORG = organization-scoped.';
comment on column public.policies.relaxation_mode is 'NON_RELAXABLE = org cannot weaken this policy (platform controls).';
