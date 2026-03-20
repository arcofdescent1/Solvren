-- Phase 0: verification_runs, verification_evidence

CREATE TABLE IF NOT EXISTS public.verification_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id uuid NOT NULL REFERENCES public.issues(id) ON DELETE CASCADE,
  verification_type text NOT NULL,
  status text NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz NULL,
  result_summary text NULL,
  result_json jsonb NULL,
  triggered_by uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_verification_runs_issue_id ON public.verification_runs(issue_id);

CREATE TABLE IF NOT EXISTS public.verification_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  verification_run_id uuid NOT NULL REFERENCES public.verification_runs(id) ON DELETE CASCADE,
  evidence_type text NOT NULL,
  reference_json jsonb NOT NULL DEFAULT '{}',
  summary text NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_verification_evidence_run_id ON public.verification_evidence(verification_run_id);
