-- Phase 0: Canonical issue object and enums

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'issue_severity') THEN
    CREATE TYPE public.issue_severity AS ENUM ('low', 'medium', 'high', 'critical');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'issue_status') THEN
    CREATE TYPE public.issue_status AS ENUM (
      'open', 'triaged', 'assigned', 'in_progress', 'resolved', 'verified', 'dismissed'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'verification_status') THEN
    CREATE TYPE public.verification_status AS ENUM ('pending', 'passed', 'failed', 'not_required');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'issue_source_type') THEN
    CREATE TYPE public.issue_source_type AS ENUM (
      'change', 'detector', 'integration_event', 'incident', 'manual', 'system_health', 'verification_failure'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.issues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  issue_key text NOT NULL,
  source_type public.issue_source_type NOT NULL,
  source_ref text NOT NULL,
  source_event_time timestamptz NULL,
  domain_key text NOT NULL,
  title text NOT NULL,
  description text NULL,
  summary text NULL,
  severity public.issue_severity NOT NULL DEFAULT 'medium',
  status public.issue_status NOT NULL DEFAULT 'open',
  verification_status public.verification_status NOT NULL DEFAULT 'pending',
  priority_score numeric(8,2) NULL,
  impact_score numeric(8,2) NULL,
  confidence_score numeric(5,2) NULL,
  owner_user_id uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  owner_team_key text NULL,
  sla_policy_key text NULL,
  opened_at timestamptz NOT NULL DEFAULT now(),
  triaged_at timestamptz NULL,
  assigned_at timestamptz NULL,
  in_progress_at timestamptz NULL,
  resolved_at timestamptz NULL,
  verified_at timestamptz NULL,
  dismissed_at timestamptz NULL,
  closed_reason text NULL,
  reopen_count integer NOT NULL DEFAULT 0,
  created_by uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(org_id, issue_key)
);

CREATE INDEX IF NOT EXISTS idx_issues_org_status ON public.issues(org_id, status);
CREATE INDEX IF NOT EXISTS idx_issues_org_severity ON public.issues(org_id, severity);
CREATE INDEX IF NOT EXISTS idx_issues_org_source_type ON public.issues(org_id, source_type);
CREATE INDEX IF NOT EXISTS idx_issues_org_domain_key ON public.issues(org_id, domain_key);
CREATE INDEX IF NOT EXISTS idx_issues_org_verification_status ON public.issues(org_id, verification_status);
CREATE INDEX IF NOT EXISTS idx_issues_org_priority_desc ON public.issues(org_id, priority_score DESC NULLS LAST);
