-- Phase 1 — Seed mapping templates for HubSpot and Salesforce.

INSERT INTO public.integration_mapping_templates (provider_key, source_object_type, canonical_object_type, name, version)
VALUES
  ('hubspot', 'contacts', 'Customer', 'HubSpot Contact → Customer', 1),
  ('hubspot', 'companies', 'Account', 'HubSpot Company → Account', 1),
  ('hubspot', 'deals', 'FunnelStep', 'HubSpot Deal → FunnelStep', 1),
  ('salesforce', 'Lead', 'Customer', 'Salesforce Lead → Customer', 1),
  ('salesforce', 'Contact', 'Customer', 'Salesforce Contact → Customer', 1),
  ('salesforce', 'Account', 'Account', 'Salesforce Account → Account', 1),
  ('salesforce', 'Opportunity', 'FunnelStep', 'Salesforce Opportunity → FunnelStep', 1),
  ('stripe', 'customer', 'Customer', 'Stripe Customer → Customer', 1),
  ('stripe', 'payment_intent', 'Transaction', 'Stripe PaymentIntent → Transaction', 1),
  ('stripe', 'charge', 'Transaction', 'Stripe Charge → Transaction', 1),
  ('stripe', 'invoice', 'Transaction', 'Stripe Invoice → Transaction', 1),
  ('stripe', 'dispute', 'IssueSignal', 'Stripe Dispute → IssueSignal', 1)
ON CONFLICT (provider_key, source_object_type, version) DO NOTHING;

DO $$
DECLARE
  tid uuid;
BEGIN
  SELECT id INTO tid FROM public.integration_mapping_templates
  WHERE provider_key = 'hubspot' AND source_object_type = 'contacts' AND version = 1 LIMIT 1;
  IF tid IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.integration_mapping_template_fields WHERE template_id = tid) THEN
    INSERT INTO public.integration_mapping_template_fields (template_id, source_path, canonical_field, transform_chain, default_value)
    VALUES
      (tid, 'id', 'externalId', '[]'::jsonb, NULL),
      (tid, 'properties.email', 'email', '[]'::jsonb, NULL),
      (tid, 'properties.firstname', 'firstName', '[{"type":"trim"}]'::jsonb, NULL),
      (tid, 'properties.lastname', 'lastName', '[{"type":"trim"}]'::jsonb, NULL);
  END IF;
END $$;
