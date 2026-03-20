-- Phase 3 — Seed signal definitions (§7, §8).
-- Code-seeded initially; admin view only.

-- Relax legacy NOT NULL columns so Phase 3 seed can omit value_type, base_weight, domain
DO $seed$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'signal_definitions' AND column_name = 'value_type') THEN
    ALTER TABLE public.signal_definitions ALTER COLUMN value_type DROP NOT NULL;
    ALTER TABLE public.signal_definitions ALTER COLUMN value_type SET DEFAULT 'BOOLEAN';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'signal_definitions' AND column_name = 'base_weight') THEN
    ALTER TABLE public.signal_definitions ALTER COLUMN base_weight DROP NOT NULL;
    ALTER TABLE public.signal_definitions ALTER COLUMN base_weight SET DEFAULT 0;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'signal_definitions' AND column_name = 'domain') THEN
    ALTER TABLE public.signal_definitions ALTER COLUMN domain DROP NOT NULL;
  END IF;
END $seed$;

INSERT INTO public.signal_definitions (
  signal_key, display_name, category, description, business_meaning,
  source_providers, canonical_entity_type, schema_version,
  required_dimensions, optional_dimensions, required_measures, optional_measures,
  required_references, idempotency_strategy
) VALUES
-- CRM
('contact_created', 'Contact Created', 'crm', 'A contact was created', 'New contact in CRM', '{hubspot,salesforce}', 'person', 1, '{}', '{provider,external_id}', '{}', '{}', '{}', 'provider_object_time'),
('contact_updated', 'Contact Updated', 'crm', 'A contact was updated', 'Contact data changed', '{hubspot,salesforce}', 'person', 1, '{}', '{provider,external_id}', '{}', '{}', '{}', 'provider_object_time'),
('deal_stage_changed', 'Deal Stage Changed', 'crm', 'A deal moved to a new stage', 'Pipeline stage change', '{hubspot,salesforce}', 'opportunity', 1, '{stage,previous_stage}', '{provider,external_id}', '{amount}', '{}', '{}', 'provider_object_stage_time'),
('lead_status_changed', 'Lead Status Changed', 'crm', 'Lead status changed', 'Lead lifecycle change', '{hubspot,salesforce}', 'person', 1, '{status}', '{provider,external_id}', '{}', '{}', '{}', 'provider_object_time'),
('opportunity_stage_changed', 'Opportunity Stage Changed', 'crm', 'Opportunity stage changed', 'Sales pipeline movement', '{salesforce}', 'opportunity', 1, '{stage}', '{provider,external_id}', '{amount}', '{}', '{}', 'provider_object_stage_time'),
('contact_duplicate_candidate', 'Contact Duplicate Candidate', 'crm', 'Potential duplicate contact detected', 'Duplicate risk', '{hubspot,salesforce}', 'person', 1, '{}', '{provider,external_id}', '{}', '{}', '{}', 'provider_object_time'),
('company_created', 'Company Created', 'crm', 'Company record created', 'New company in CRM', '{hubspot,salesforce}', 'company', 1, '{}', '{provider,external_id}', '{}', '{}', '{}', 'provider_object_time'),
('company_updated', 'Company Updated', 'crm', 'Company record updated', 'Company data changed', '{hubspot,salesforce}', 'company', 1, '{}', '{provider,external_id}', '{}', '{}', '{}', 'provider_object_time'),
-- Billing
('payment_failed', 'Payment Failed', 'billing', 'A payment attempt failed', 'Payment failure', '{stripe}', 'payment', 1, '{failure_code}', '{provider,external_id}', '{amount}', '{}', '{invoice_id,subscription_id}', 'provider_invoice_failure_time'),
('invoice_past_due', 'Invoice Past Due', 'billing', 'Invoice is past due', 'Overdue invoice', '{stripe}', 'invoice', 1, '{}', '{provider,external_id}', '{amount_due}', '{}', '{subscription_id}', 'provider_object_time'),
('invoice_paid', 'Invoice Paid', 'billing', 'Invoice was paid', 'Successful payment', '{stripe}', 'invoice', 1, '{}', '{provider,external_id}', '{amount}', '{}', '{subscription_id}', 'provider_object_time'),
('subscription_canceled', 'Subscription Canceled', 'billing', 'Subscription was canceled', 'Churn event', '{stripe}', 'subscription', 1, '{cancel_reason}', '{provider,external_id}', '{mrr}', '{}', '{}', 'provider_object_time'),
('subscription_created', 'Subscription Created', 'billing', 'New subscription created', 'New recurring revenue', '{stripe}', 'subscription', 1, '{}', '{provider,external_id}', '{mrr}', '{}', '{}', 'provider_object_time'),
('checkout_failed', 'Checkout Failed', 'billing', 'Checkout failed', 'Payment/checkout failure', '{stripe}', 'payment', 1, '{failure_code}', '{provider,external_id}', '{amount}', '{}', '{}', 'provider_object_time'),
-- Scheduling
('meeting_booked', 'Meeting Booked', 'scheduling', 'Meeting was booked', 'New meeting', '{chilipiper,oncehub,calendly}', 'meeting', 1, '{outcome}', '{provider,external_id}', '{}', '{}', '{opportunity_id}', 'provider_object_time'),
('meeting_canceled', 'Meeting Canceled', 'scheduling', 'Meeting was canceled', 'Meeting cancellation', '{chilipiper,oncehub,calendly}', 'meeting', 1, '{}', '{provider,external_id}', '{}', '{}', '{}', 'provider_object_time'),
('meeting_no_show', 'Meeting No-Show', 'scheduling', 'Meeting no-show detected', 'Missed meeting', '{chilipiper,oncehub,calendly}', 'meeting', 1, '{}', '{provider,external_id}', '{}', '{}', '{}', 'provider_object_time'),
-- Change governance
('change_created', 'Change Created', 'change_governance', 'Change record created', 'New change request', '{internal}', 'change', 1, '{}', '{}', '{}', '{}', '{change_id}', 'internal_object_time'),
('change_submitted', 'Change Submitted', 'change_governance', 'Change was submitted for approval', 'Change submitted', '{internal}', 'change', 1, '{status}', '{}', '{}', '{}', '{change_id}', 'internal_object_time'),
('change_approved', 'Change Approved', 'change_governance', 'Change was approved', 'Approval granted', '{internal}', 'change', 1, '{status}', '{}', '{}', '{}', '{change_id}', 'internal_object_time'),
('change_rejected', 'Change Rejected', 'change_governance', 'Change was rejected', 'Approval denied', '{internal}', 'change', 1, '{status}', '{}', '{}', '{}', '{change_id}', 'internal_object_time'),
('change_deployed', 'Change Deployed', 'change_governance', 'Change was deployed', 'Deployment completed', '{internal}', 'change', 1, '{}', '{}', '{}', '{}', '{change_id}', 'internal_object_time'),
('change_blocked', 'Change Blocked', 'change_governance', 'Change was blocked', 'Blocking issue', '{internal}', 'change', 1, '{reason}', '{}', '{}', '{}', '{change_id}', 'internal_object_time'),
('approval_decided', 'Approval Decided', 'change_governance', 'Approval decision made', 'Approval workflow', '{internal}', 'change', 1, '{decision}', '{}', '{}', '{}', '{change_id}', 'internal_object_time')
ON CONFLICT (signal_key) DO NOTHING;
