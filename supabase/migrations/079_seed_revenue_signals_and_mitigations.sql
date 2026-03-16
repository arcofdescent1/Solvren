-- Phase 3 Pass 1 — Seed REVENUE signals + mitigations

-- Signals (REVENUE)
INSERT INTO public.domain_signals (domain_key, signal_key, name, description, severity, default_weight, detector)
VALUES
  (
    'REVENUE',
    'PRICING_CHANGE',
    'Pricing / Plan Change',
    'Any change that modifies pricing, plan packaging, coupons, or billing rules.',
    'CRITICAL',
    1.8,
    jsonb_build_object(
      'keywords', jsonb_build_array('pricing','price','plan','plans','tier','subscription','billing','coupon','discount','promo','trial'),
      'regex', '(pricing|price|plan|tier|billing|subscription|coupon|discount|promo|trial)'
    )
  ),
  (
    'REVENUE',
    'CHECKOUT_FLOW',
    'Checkout / Payment Flow',
    'Changes to checkout UX, payment processor, or purchase flow.',
    'CRITICAL',
    1.7,
    jsonb_build_object(
      'keywords', jsonb_build_array('checkout','payment','stripe','paypal','cart','order','purchase','invoice','charge'),
      'regex', '(checkout|payment|stripe|paypal|cart|order|purchase|invoice|charge)'
    )
  ),
  (
    'REVENUE',
    'ENTITLEMENTS_ACCESS',
    'Entitlements / Access Control',
    'Changes that could grant or block paid access incorrectly.',
    'HIGH',
    1.4,
    jsonb_build_object(
      'keywords', jsonb_build_array('entitlement','entitlements','access','gating','paywall','feature flag','license'),
      'regex', '(entitlement|access|gating|paywall|license|feature\s*flag)'
    )
  ),
  (
    'REVENUE',
    'CANCELLATION_RETENTION',
    'Cancellation / Retention Flow',
    'Changes impacting cancellation, downgrade, pause, winback, or retention surfaces.',
    'HIGH',
    1.3,
    jsonb_build_object(
      'keywords', jsonb_build_array('cancel','cancellation','downgrade','pause','winback','retention','churn'),
      'regex', '(cancel|cancellation|downgrade|pause|winback|retention|churn)'
    )
  ),
  (
    'REVENUE',
    'TAX_COMPLIANCE',
    'Tax / Compliance',
    'Changes that could affect taxes, invoicing rules, receipts, compliance requirements.',
    'HIGH',
    1.3,
    jsonb_build_object(
      'keywords', jsonb_build_array('tax','vat','sales tax','receipt','invoice','compliance'),
      'regex', '(tax|vat|sales\s*tax|receipt|invoice|compliance)'
    )
  ),
  (
    'REVENUE',
    'REFUNDS_CHARGEBACKS',
    'Refunds / Chargebacks',
    'Changes affecting refund logic, disputes, chargebacks, or fraud flows.',
    'HIGH',
    1.2,
    jsonb_build_object(
      'keywords', jsonb_build_array('refund','chargeback','dispute','fraud','risk','charge back'),
      'regex', '(refund|chargeback|dispute|fraud|charge\s*back)'
    )
  ),
  (
    'REVENUE',
    'INTEGRATION_BILLING_WEBHOOKS',
    'Billing Webhooks / Integrations',
    'Changes to webhooks, billing sync, revenue recognition, or downstream systems.',
    'HIGH',
    1.2,
    jsonb_build_object(
      'keywords', jsonb_build_array('webhook','webhooks','stripe webhook','billing webhook','revenue recognition','sync'),
      'regex', '(webhook|revenue\s*recognition|billing\s*sync|subscription\s*sync)'
    )
  ),
  (
    'REVENUE',
    'PROMO_ABUSE',
    'Promotion Abuse Risk',
    'Changes that could enable discount abuse or loopholes.',
    'MEDIUM',
    1.1,
    jsonb_build_object(
      'keywords', jsonb_build_array('promo','discount','coupon','stacking','abuse'),
      'regex', '(promo|discount|coupon|stacking|abuse)'
    )
  )
ON CONFLICT (domain_key, signal_key) DO UPDATE
  SET name = excluded.name,
      description = excluded.description,
      severity = excluded.severity,
      default_weight = excluded.default_weight,
      detector = excluded.detector;

-- Mitigations per signal (REVENUE)
INSERT INTO public.domain_signal_mitigations (domain_key, signal_key, mitigation_key, recommendation, severity)
VALUES
  ('REVENUE','PRICING_CHANGE','PRICE_CHANGE_CHECKLIST','Run pricing change checklist: verify plan mapping, proration, invoices, discounts, and taxes in staging.','CRITICAL'),
  ('REVENUE','PRICING_CHANGE','SHADOW_BILLING','Shadow-bill internally for 24 hours (no customer impact) and compare expected vs actual invoices.','HIGH'),
  ('REVENUE','CHECKOUT_FLOW','CHECKOUT_SMOKE_TEST','Run end-to-end smoke tests (new purchase, upgrade, downgrade, renewal) in staging and prod canary.','CRITICAL'),
  ('REVENUE','CHECKOUT_FLOW','CANARY_RELEASE','Canary release checkout changes to 5% of traffic and monitor conversion + payment failures.','HIGH'),
  ('REVENUE','ENTITLEMENTS_ACCESS','ENTITLEMENTS_AUDIT','Audit entitlement rules: ensure paid access requires active subscription; verify downgrade/cancel transitions.','HIGH'),
  ('REVENUE','ENTITLEMENTS_ACCESS','ROLE_GATING_TESTS','Add regression tests for paywall/feature gating and role-based access.','HIGH'),
  ('REVENUE','CANCELLATION_RETENTION','CANCEL_FLOW_REVIEW','Review cancellation UX: ensure users can cancel, confirm effective dates, and validate winback offers don''t block.','MEDIUM'),
  ('REVENUE','TAX_COMPLIANCE','TAX_PROVIDER_VALIDATION','Validate tax provider settings (nexus, product tax codes) and sample invoices across regions.','HIGH'),
  ('REVENUE','REFUNDS_CHARGEBACKS','REFUND_POLICY_TEST','Test refund flow and webhook events end-to-end; ensure dispute notifications are routed.','MEDIUM'),
  ('REVENUE','INTEGRATION_BILLING_WEBHOOKS','WEBHOOK_REPLAY','Replay recent webhook events in staging; verify idempotency and downstream reconciliation.','HIGH'),
  ('REVENUE','PROMO_ABUSE','PROMO_GUARDRAILS','Add promo guardrails: no stacking, enforce limits per customer, monitor anomaly alerts.','MEDIUM')
ON CONFLICT (domain_key, signal_key, mitigation_key) DO UPDATE
  SET recommendation = excluded.recommendation,
      severity = excluded.severity;
