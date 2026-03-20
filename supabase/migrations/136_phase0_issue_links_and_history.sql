-- Phase 0: issue_sources, issue_entities, issue_history, issue_actions, issue_comments

CREATE TABLE IF NOT EXISTS public.issue_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id uuid NOT NULL REFERENCES public.issues(id) ON DELETE CASCADE,
  source_type text NOT NULL,
  source_ref text NOT NULL,
  evidence_json jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_issue_sources_issue_id ON public.issue_sources(issue_id);

CREATE TABLE IF NOT EXISTS public.issue_entities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id uuid NOT NULL REFERENCES public.issues(id) ON DELETE CASCADE,
  entity_type text NOT NULL,
  external_system text NOT NULL,
  external_object_type text NULL,
  external_id text NOT NULL,
  canonical_entity_id uuid NULL,
  entity_display_name text NULL,
  metadata_json jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_issue_entities_issue_id ON public.issue_entities(issue_id);

CREATE TABLE IF NOT EXISTS public.issue_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id uuid NOT NULL REFERENCES public.issues(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  event_actor_type text NULL,
  event_actor_ref text NULL,
  old_state_json jsonb NULL,
  new_state_json jsonb NULL,
  metadata_json jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_issue_history_issue_id ON public.issue_history(issue_id);

CREATE TABLE IF NOT EXISTS public.issue_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id uuid NOT NULL REFERENCES public.issues(id) ON DELETE CASCADE,
  action_type text NOT NULL,
  action_status text NOT NULL,
  requested_by uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  external_system text NULL,
  target_ref text NULL,
  request_json jsonb NULL,
  response_json jsonb NULL,
  error_json jsonb NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  executed_at timestamptz NULL
);

CREATE INDEX IF NOT EXISTS idx_issue_actions_issue_id ON public.issue_actions(issue_id);

CREATE TABLE IF NOT EXISTS public.issue_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id uuid NOT NULL REFERENCES public.issues(id) ON DELETE CASCADE,
  author_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body text NOT NULL,
  visibility text NOT NULL DEFAULT 'internal',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_issue_comments_issue_id ON public.issue_comments(issue_id);
