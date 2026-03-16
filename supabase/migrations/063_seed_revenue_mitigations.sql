-- Phase 1A Pass 2 — Opinionated Revenue mitigations seed (idempotent)
-- Uses signal keys that match existing signal_definitions and deterministic rules.

CREATE OR REPLACE FUNCTION public.seed_revenue_mitigations(p_org_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  -- Org-scoped mitigations. Uses unique index ux_signal_mitigations_org_domain_signal_reco
  -- (requires 062 to have run; org_id must exist)
  INSERT INTO public.signal_mitigations (org_id, domain, signal_key, recommendation, severity, metadata)
  VALUES
    -- Pricing
    (p_org_id, 'REVENUE', 'modifies_pricing_logic', 'Run pricing simulation on representative cohorts (top plans + promos).', 'HIGH', '{"type":"checklist"}'),
    (p_org_id, 'REVENUE', 'modifies_pricing_logic', 'Require finance sign-off for pricing changes affecting paid tiers.', 'CRITICAL', '{"type":"approval"}'),

    -- Billing
    (p_org_id, 'REVENUE', 'affects_active_billing_system', 'Add a canary rollout (5% traffic) + monitor conversion & payment failures.', 'CRITICAL', '{"type":"rollout"}'),
    (p_org_id, 'REVENUE', 'affects_active_billing_system', 'Backfill/validate invoices in staging with last 30 days before deploy.', 'HIGH', '{"type":"validation"}'),

    -- Backfill
    (p_org_id, 'REVENUE', 'backfill_required', 'Run backfill dry-run on a small cohort before full execution.', 'HIGH', '{"type":"checklist"}'),
    (p_org_id, 'REVENUE', 'backfill_required', 'Create a rollback plan that restores prior billing logic within 30 minutes.', 'HIGH', '{"type":"rollback"}'),

    -- DB migration
    (p_org_id, 'REVENUE', 'requires_database_migration', 'Dual-write to old + new schema for 24 hours before cutover.', 'CRITICAL', '{"type":"migration"}'),
    (p_org_id, 'REVENUE', 'requires_database_migration', 'Attach rollback SQL and verify down migration in staging.', 'HIGH', '{"type":"rollback"}'),

    -- Payment flow
    (p_org_id, 'REVENUE', 'touches_payment_processing_flow', 'Verify dispute/refund flows and reconciliation reports end-to-end.', 'HIGH', '{"type":"validation"}'),
    (p_org_id, 'REVENUE', 'touches_payment_processing_flow', 'Add synthetic checkout monitors for top 3 payment methods.', 'HIGH', '{"type":"monitoring"}'),

    -- No rollback
    (p_org_id, 'REVENUE', 'no_rollback_path_defined', 'Add automated tests that ensure entitlements match plan matrix.', 'HIGH', '{"type":"tests"}'),
    (p_org_id, 'REVENUE', 'no_rollback_path_defined', 'Audit top 20 customers before and after change (sample-based).', 'MEDIUM', '{"type":"audit"}')
  ON CONFLICT (org_id, domain, signal_key, recommendation) WHERE org_id IS NOT NULL
  DO UPDATE SET
    severity = EXCLUDED.severity,
    metadata = EXCLUDED.metadata,
    updated_at = now();

END;
$$;
