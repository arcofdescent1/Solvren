import type { ORG_PURGE_TABLE_SPECS } from "./org-purge-tables.generated";

export type OrgPurgeTableSpec = (typeof ORG_PURGE_TABLE_SPECS)[number];

export type PurgeStepKey =
  | "quiesce_org"
  | "purge_queues"
  | "purge_integrations"
  | "purge_billing"
  | "purge_identity_access"
  | "purge_object_storage"
  | "purge_database";

export const PURGE_STEP_ORDER: PurgeStepKey[] = [
  "quiesce_org",
  "purge_queues",
  "purge_integrations",
  "purge_billing",
  "purge_identity_access",
  "purge_object_storage",
  "purge_database",
];

export type RetentionExceptionCode =
  | "RETAIN_FINANCE"
  | "RETAIN_LEGAL_HOLD"
  | "RETAIN_BACKUP_ONLY"
  | "RETAIN_PLATFORM_SHARED"
  | "RETAIN_ANONYMIZED_AGGREGATE";

export type OrgPurgeRequestStatus =
  | "pending_approval"
  | "approved"
  | "rejected"
  | "blocked_legal_hold"
  | "cancelled"
  | "superseded";

export type OrgPurgeRunStatus = "pending" | "running" | "completed" | "failed" | "partial";

export type OrgPurgeRunStepStatus = "pending" | "running" | "completed" | "failed" | "skipped";

export type TableRowCount = {
  table: string;
  orgColumn: string;
  count: number | null;
  error?: string;
};

export type PurgePlan = {
  targetOrgId: string;
  blocked: boolean;
  blockReason?: string;
  retentionExceptions: { code: RetentionExceptionCode; note: string }[];
  tableCounts: TableRowCount[];
  organizationRowExists: boolean;
  integrationAccounts: { id: string; provider: string; displayName: string }[];
  processingJobsPending: number | null;
  storagePrefixSample: string[];
  explicitPreOrgDeletes: string[];
  financeSnapshotRequired: boolean;
};
