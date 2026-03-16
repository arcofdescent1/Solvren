-- Phase 1A Pass 1 — Extend signal_mitigations for org-scoped + metadata
-- (048 created base table; this adds org_id, metadata, severity enum)

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'mitigation_severity') THEN
    CREATE TYPE public.mitigation_severity AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
  END IF;
END $$;

-- Add org_id (nullable = global), metadata
ALTER TABLE public.signal_mitigations
  ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}';

-- Add severity_enum for new installs; keep severity text for backward compat
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'signal_mitigations' AND column_name = 'severity_enum'
  ) AND EXISTS (SELECT 1 FROM pg_type WHERE typname = 'mitigation_severity') THEN
    ALTER TABLE public.signal_mitigations ADD COLUMN severity_enum public.mitigation_severity NULL;
  END IF;
END $$;

-- Add updated_at if not exists
ALTER TABLE public.signal_mitigations
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Unique: per-org rows (org_id NOT NULL)
CREATE UNIQUE INDEX IF NOT EXISTS ux_signal_mitigations_org_domain_signal_reco
  ON public.signal_mitigations(org_id, domain, signal_key, recommendation)
  WHERE org_id IS NOT NULL;

-- Unique: global rows (org_id IS NULL) - one per domain+signal+recommendation
CREATE UNIQUE INDEX IF NOT EXISTS ux_signal_mitigations_global_domain_signal_reco
  ON public.signal_mitigations(COALESCE(domain, ''), signal_key, recommendation)
  WHERE org_id IS NULL;

-- Query path index
CREATE INDEX IF NOT EXISTS idx_signal_mitigations_org_domain_signal
  ON public.signal_mitigations(org_id, domain, signal_key);

-- updated_at trigger
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'set_updated_at') THEN
    CREATE OR REPLACE FUNCTION public.set_updated_at()
    RETURNS trigger LANGUAGE plpgsql AS $fn$
    BEGIN
      NEW.updated_at = now();
      RETURN NEW;
    END;
    $fn$;
  END IF;
END $$;

DROP TRIGGER IF EXISTS trg_signal_mitigations_updated_at ON public.signal_mitigations;
CREATE TRIGGER trg_signal_mitigations_updated_at
  BEFORE UPDATE ON public.signal_mitigations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
