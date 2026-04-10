-- Phase 6 gap closeout — org thresholds, reports metadata, value story nullable value, report types

ALTER TABLE public.value_stories
  ALTER COLUMN estimated_value DROP NOT NULL;

ALTER TABLE public.organization_settings
  ADD COLUMN IF NOT EXISTS major_outage_revenue_threshold_usd numeric NOT NULL DEFAULT 100000,
  ADD COLUMN IF NOT EXISTS major_outage_customer_threshold int NOT NULL DEFAULT 1000,
  ADD COLUMN IF NOT EXISTS production_critical_domains text[] NULL,
  ADD COLUMN IF NOT EXISTS notify_admins_on_outcomes boolean NOT NULL DEFAULT false;

ALTER TABLE public.generated_reports
  ADD COLUMN IF NOT EXISTS requesting_user_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS error_json jsonb NULL,
  ADD COLUMN IF NOT EXISTS storage_path text NULL;

ALTER TABLE public.generated_reports DROP CONSTRAINT IF EXISTS generated_reports_report_type_check;

ALTER TABLE public.generated_reports
  ADD CONSTRAINT generated_reports_report_type_check CHECK (
    report_type IN (
      'MONTHLY_PDF',
      'QUARTERLY_PPTX',
      'CSV_EXPORT',
      'MONTHLY_EXEC_SUMMARY',
      'QUARTERLY_BUSINESS_REVIEW',
      'VALUE_STORY_EXPORT'
    )
  );

ALTER TABLE public.generated_reports DROP CONSTRAINT IF EXISTS generated_reports_status_check;

ALTER TABLE public.generated_reports
  ADD CONSTRAINT generated_reports_status_check CHECK (
    status IN ('PENDING', 'QUEUED', 'PROCESSING', 'COMPLETED', 'COMPLETE', 'FAILED')
  );

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'generated-reports',
  'generated-reports',
  false,
  52428800,
  ARRAY[
    'text/csv',
    'application/csv',
    'text/plain',
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;
