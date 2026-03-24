import type { RetentionExceptionCode } from "./types";

/** Human-readable policy lines for UI and dry-run payloads. */
export const ORG_PURGE_RETENTION_POLICY_LINES: { code: RetentionExceptionCode; note: string }[] = [
  {
    code: "RETAIN_FINANCE",
    note: "Billing/finance: snapshot to org_purge_finance_retention_snapshots; cancel subscriptions; live billing_accounts row cascades on org delete.",
  },
  {
    code: "RETAIN_LEGAL_HOLD",
    note: "Legal hold: blocks execution when legal_hold_active is true on the purge request.",
  },
  {
    code: "RETAIN_BACKUP_ONLY",
    note: "Backups are not rewritten during purge; they expire per backup retention policy.",
  },
  {
    code: "RETAIN_PLATFORM_SHARED",
    note: "Platform rows (e.g. policies with org_id IS NULL) are not targeted by org-scoped eq filters.",
  },
  {
    code: "RETAIN_ANONYMIZED_AGGREGATE",
    note: "Irreversibly anonymized aggregates may be retained only when explicitly documented; v1 defaults to purge org-identifiable data.",
  },
];
