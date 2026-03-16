-- Phase 3 — Starter signals for SECURITY, DATA, WORKFLOW

-- SECURITY signals
INSERT INTO public.domain_signals (
  domain_key, signal_key, name, description, severity, default_weight, detector
)
VALUES
  (
    'SECURITY','AUTH_ACCESS',
    'Authentication / Access Control',
    'Changes affecting auth, permissions, roles, SSO, tokens, session handling.',
    'CRITICAL', 1.8,
    jsonb_build_object(
      'keywords', jsonb_build_array('auth','authentication','authorization','permission','permissions','roles','role','sso','oauth','oidc','token','jwt','session','keycloak'),
      'regex', '(auth|authentication|authorization|permission|roles?|sso|oauth|oidc|token|jwt|session|keycloak)'
    )
  ),
  (
    'SECURITY','SECRETS_KEYS',
    'Secrets / Keys / Credentials',
    'Changes involving secrets, API keys, encryption keys, credentials.',
    'CRITICAL', 1.7,
    jsonb_build_object(
      'keywords', jsonb_build_array('secret','secrets','api key','apikey','credential','credentials','private key','encryption key','kms','vault'),
      'regex', '(secret|api\s*key|apikey|credential|private\s*key|encryption\s*key|kms|vault)'
    )
  ),
  (
    'SECURITY','NETWORK_PERIMETER',
    'Network / Perimeter',
    'Changes to networking, firewall rules, CORS, ingress, public exposure.',
    'HIGH', 1.4,
    jsonb_build_object(
      'keywords', jsonb_build_array('cors','firewall','security group','ingress','egress','vpn','public','expose','exposed','waf'),
      'regex', '(cors|firewall|security\s*group|ingress|egress|vpn|waf|expos(e|ed)|public)'
    )
  ),
  (
    'SECURITY','DATA_PRIVACY',
    'PII / Data Privacy',
    'Changes that touch PII, PHI, privacy, retention, data exports.',
    'HIGH', 1.5,
    jsonb_build_object(
      'keywords', jsonb_build_array('pii','phi','privacy','gdpr','hipaa','retention','data export','export','delete request'),
      'regex', '(pii|phi|privacy|gdpr|hipaa|retention|data\s*export|delete\s*request)'
    )
  )
ON CONFLICT (domain_key, signal_key) DO UPDATE
  SET name = excluded.name,
      description = excluded.description,
      severity = excluded.severity,
      default_weight = excluded.default_weight,
      detector = excluded.detector;

INSERT INTO public.domain_signal_mitigations (domain_key, signal_key, mitigation_key, recommendation, severity)
VALUES
  ('SECURITY','AUTH_ACCESS','SEC_REVIEW_AUTH','Security review of auth changes: verify flows, token lifetimes, scopes, and role mappings.','CRITICAL'),
  ('SECURITY','AUTH_ACCESS','TEST_AUTH_REGRESSION','Add/Run auth regression tests (login, refresh, logout, role gates).','HIGH'),
  ('SECURITY','SECRETS_KEYS','NO_SECRETS_IN_CODE','Verify no secrets in code/logs. Rotate impacted keys if exposure suspected.','CRITICAL'),
  ('SECURITY','SECRETS_KEYS','KMS_VAULT_ONLY','Store secrets in Vault/KMS; enforce least privilege and access logging.','HIGH'),
  ('SECURITY','NETWORK_PERIMETER','REVIEW_PUBLIC_EXPOSURE','Review public exposure; validate CORS, WAF, and ingress rules.','HIGH'),
  ('SECURITY','DATA_PRIVACY','PRIVACY_IMPACT_CHECK','Run privacy impact check: retention, access controls, audit logs, export gates.','HIGH')
ON CONFLICT (domain_key, signal_key, mitigation_key) DO UPDATE
  SET recommendation = excluded.recommendation,
      severity = excluded.severity;

-- DATA signals
INSERT INTO public.domain_signals (
  domain_key, signal_key, name, description, severity, default_weight, detector
)
VALUES
  (
    'DATA','SCHEMA_MIGRATION',
    'Schema / Migration',
    'Changes involving database migrations, schema changes, indexes, constraints.',
    'HIGH', 1.5,
    jsonb_build_object(
      'keywords', jsonb_build_array('migration','schema','ddl','alter table','index','constraint','postgres','prisma migrate'),
      'regex', '(migration|schema|ddl|alter\s+table|index|constraint|postgres|prisma\s+migrate)'
    )
  ),
  (
    'DATA','PIPELINE_ETL',
    'Pipeline / ETL',
    'Changes to ingestion, ETL jobs, cron pipelines, transforms.',
    'MEDIUM', 1.2,
    jsonb_build_object(
      'keywords', jsonb_build_array('etl','pipeline','ingest','ingestion','transform','cron','job','batch'),
      'regex', '(etl|pipeline|ingest(ion)?|transform|cron|batch)'
    )
  ),
  (
    'DATA','DATA_QUALITY',
    'Data Quality / Integrity',
    'Changes that may impact correctness, dedupe, idempotency, reconciliation.',
    'HIGH', 1.3,
    jsonb_build_object(
      'keywords', jsonb_build_array('idempotent','dedupe','reconcile','integrity','consistency','backfill','replay'),
      'regex', '(idempotent|dedupe|reconcile|integrity|consisten|backfill|replay)'
    )
  ),
  (
    'DATA','PERFORMANCE_QUERY',
    'Query / Performance',
    'Changes that may impact query performance, load, caching.',
    'MEDIUM', 1.1,
    jsonb_build_object(
      'keywords', jsonb_build_array('query','index','slow','performance','cache','caching','latency'),
      'regex', '(query|index|performance|cache|latency|slow)'
    )
  )
ON CONFLICT (domain_key, signal_key) DO UPDATE
  SET name = excluded.name,
      description = excluded.description,
      severity = excluded.severity,
      default_weight = excluded.default_weight,
      detector = excluded.detector;

INSERT INTO public.domain_signal_mitigations (domain_key, signal_key, mitigation_key, recommendation, severity)
VALUES
  ('DATA','SCHEMA_MIGRATION','MIGRATION_REVIEW','Review migration plan: rollback, locking risk, long-running operations, backfill strategy.','HIGH'),
  ('DATA','SCHEMA_MIGRATION','STAGING_REHEARSAL','Rehearse migration on staging with production-like data; measure timing and locks.','HIGH'),
  ('DATA','PIPELINE_ETL','IDEMPOTENT_RUNS','Ensure ETL jobs are idempotent and safe to re-run; add checkpointing.','MEDIUM'),
  ('DATA','DATA_QUALITY','RECONCILIATION_CHECKS','Add reconciliation checks & anomaly alerts for key metrics post-change.','HIGH'),
  ('DATA','PERFORMANCE_QUERY','EXPLAIN_ANALYZE','Run EXPLAIN ANALYZE on key queries; validate indexes and latency budgets.','MEDIUM')
ON CONFLICT (domain_key, signal_key, mitigation_key) DO UPDATE
  SET recommendation = excluded.recommendation,
      severity = excluded.severity;

-- WORKFLOW signals
INSERT INTO public.domain_signals (
  domain_key, signal_key, name, description, severity, default_weight, detector
)
VALUES
  (
    'WORKFLOW','NOTIFICATION_DELIVERY',
    'Notifications / Delivery',
    'Changes to email, slack, in-app delivery, outbox, retries, dedupe.',
    'MEDIUM', 1.2,
    jsonb_build_object(
      'keywords', jsonb_build_array('notification','outbox','retry','retries','dedupe','email','slack','delivery'),
      'regex', '(notification|outbox|retry|dedupe|email|slack|delivery)'
    )
  ),
  (
    'WORKFLOW','APPROVAL_FLOW',
    'Approval / Governance Flow',
    'Changes to approvals, requirements, SLA evaluation, escalation.',
    'MEDIUM', 1.2,
    jsonb_build_object(
      'keywords', jsonb_build_array('approval','approve','reject','sla','escalat','governance'),
      'regex', '(approval|approve|reject|sla|escalat|governance)'
    )
  ),
  (
    'WORKFLOW','UI_CRITICAL_PATH',
    'Critical UX Path',
    'Changes to core UI flows that affect user success metrics.',
    'MEDIUM', 1.1,
    jsonb_build_object(
      'keywords', jsonb_build_array('onboarding','signup','login','checkout','critical path','conversion'),
      'regex', '(onboarding|signup|login|checkout|conversion|critical\s*path)'
    )
  ),
  (
    'WORKFLOW','DEPLOYMENT_RELEASE',
    'Deployment / Release',
    'Changes to deployment, release process, feature flags, rollbacks.',
    'MEDIUM', 1.1,
    jsonb_build_object(
      'keywords', jsonb_build_array('deploy','deployment','release','rollback','feature flag','vercel','supabase migration'),
      'regex', '(deploy|deployment|release|rollback|feature\s*flag|vercel|supabase\s+migration)'
    )
  )
ON CONFLICT (domain_key, signal_key) DO UPDATE
  SET name = excluded.name,
      description = excluded.description,
      severity = excluded.severity,
      default_weight = excluded.default_weight,
      detector = excluded.detector;

INSERT INTO public.domain_signal_mitigations (domain_key, signal_key, mitigation_key, recommendation, severity)
VALUES
  ('WORKFLOW','NOTIFICATION_DELIVERY','DELIVERY_SMOKE_TEST','Send test notifications across channels; validate dedupe and retry behavior.','MEDIUM'),
  ('WORKFLOW','APPROVAL_FLOW','APPROVAL_SIMULATION','Simulate approval + escalation scenarios in staging; verify audit logs and SLA ticks.','MEDIUM'),
  ('WORKFLOW','UI_CRITICAL_PATH','UX_SMOKE_TEST','Smoke test critical UX flows; validate conversion instrumentation still fires.','MEDIUM'),
  ('WORKFLOW','DEPLOYMENT_RELEASE','ROLLBACK_READY','Confirm rollback plan and feature flag kill switch; monitor for first hour post-deploy.','MEDIUM')
ON CONFLICT (domain_key, signal_key, mitigation_key) DO UPDATE
  SET recommendation = excluded.recommendation,
      severity = excluded.severity;
