-- Phase 3 — Seed CSV mapping templates for the upload wizard.

INSERT INTO public.integration_mapping_templates (provider_key, source_object_type, canonical_object_type, name, version)
VALUES
  ('csv', 'generic', 'Customer', 'CSV Generic → Customer', 1),
  ('csv', 'customers', 'Customer', 'CSV Customers → Customer', 1),
  ('csv', 'transactions', 'Transaction', 'CSV Transactions → Transaction', 1),
  ('csv', 'subscriptions', 'Subscription', 'CSV Subscriptions → Subscription', 1)
ON CONFLICT (provider_key, source_object_type, version) DO NOTHING;

-- Generic → Customer: common column name mappings
DO $$
DECLARE
  tid uuid;
BEGIN
  SELECT id INTO tid FROM public.integration_mapping_templates
  WHERE provider_key = 'csv' AND source_object_type = 'generic' AND canonical_object_type = 'Customer' AND version = 1 LIMIT 1;
  IF tid IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.integration_mapping_template_fields WHERE template_id = tid) THEN
    INSERT INTO public.integration_mapping_template_fields (template_id, source_path, canonical_field, transform_chain, default_value)
    VALUES
      (tid, 'id', 'externalId', '[]'::jsonb, NULL),
      (tid, 'email', 'email', '[]'::jsonb, NULL),
      (tid, 'name', 'displayName', '[]'::jsonb, NULL),
      (tid, 'first_name', 'firstName', '[{"type":"trim"}]'::jsonb, NULL),
      (tid, 'last_name', 'lastName', '[{"type":"trim"}]'::jsonb, NULL);
  END IF;
END $$;

-- Customers → Customer
DO $$
DECLARE
  tid uuid;
BEGIN
  SELECT id INTO tid FROM public.integration_mapping_templates
  WHERE provider_key = 'csv' AND source_object_type = 'customers' AND version = 1 LIMIT 1;
  IF tid IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.integration_mapping_template_fields WHERE template_id = tid) THEN
    INSERT INTO public.integration_mapping_template_fields (template_id, source_path, canonical_field, transform_chain, default_value)
    VALUES
      (tid, 'id', 'externalId', '[]'::jsonb, NULL),
      (tid, 'customer_id', 'externalId', '[]'::jsonb, NULL),
      (tid, 'email', 'email', '[]'::jsonb, NULL),
      (tid, 'name', 'displayName', '[]'::jsonb, NULL),
      (tid, 'first_name', 'firstName', '[{"type":"trim"}]'::jsonb, NULL),
      (tid, 'last_name', 'lastName', '[{"type":"trim"}]'::jsonb, NULL);
  END IF;
END $$;

-- Transactions → Transaction
DO $$
DECLARE
  tid uuid;
BEGIN
  SELECT id INTO tid FROM public.integration_mapping_templates
  WHERE provider_key = 'csv' AND source_object_type = 'transactions' AND version = 1 LIMIT 1;
  IF tid IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.integration_mapping_template_fields WHERE template_id = tid) THEN
    INSERT INTO public.integration_mapping_template_fields (template_id, source_path, canonical_field, transform_chain, default_value)
    VALUES
      (tid, 'id', 'externalId', '[]'::jsonb, NULL),
      (tid, 'transaction_id', 'externalId', '[]'::jsonb, NULL),
      (tid, 'amount', 'amount', '[]'::jsonb, NULL),
      (tid, 'currency', 'currency', '[]'::jsonb, NULL),
      (tid, 'customer_id', 'customerExternalId', '[]'::jsonb, NULL),
      (tid, 'date', 'createdAt', '[{"type":"date_parse"}]'::jsonb, NULL),
      (tid, 'created_at', 'createdAt', '[{"type":"date_parse"}]'::jsonb, NULL);
  END IF;
END $$;

-- Subscriptions → Subscription
DO $$
DECLARE
  tid uuid;
BEGIN
  SELECT id INTO tid FROM public.integration_mapping_templates
  WHERE provider_key = 'csv' AND source_object_type = 'subscriptions' AND version = 1 LIMIT 1;
  IF tid IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.integration_mapping_template_fields WHERE template_id = tid) THEN
    INSERT INTO public.integration_mapping_template_fields (template_id, source_path, canonical_field, transform_chain, default_value)
    VALUES
      (tid, 'id', 'externalId', '[]'::jsonb, NULL),
      (tid, 'subscription_id', 'externalId', '[]'::jsonb, NULL),
      (tid, 'customer_id', 'customerExternalId', '[]'::jsonb, NULL),
      (tid, 'status', 'status', '[]'::jsonb, NULL),
      (tid, 'plan', 'planId', '[]'::jsonb, NULL),
      (tid, 'current_period_start', 'currentPeriodStart', '[{"type":"date_parse"}]'::jsonb, NULL),
      (tid, 'current_period_end', 'currentPeriodEnd', '[{"type":"date_parse"}]'::jsonb, NULL);
  END IF;
END $$;
