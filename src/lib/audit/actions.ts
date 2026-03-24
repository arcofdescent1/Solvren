/**
 * Phase 0 — normalized audit action taxonomy (use these strings in audit_log.action).
 * Legacy actions may still exist in DB; new code should prefer these names.
 */
export type Phase0AuditAction =
  | "auth.login_succeeded"
  | "auth.logout"
  | "org.settings.updated"
  | "org.member.added"
  | "org.member.removed"
  | "org.member.role_changed"
  | "change.created"
  | "change.updated"
  | "change.submitted"
  | "change.approved"
  | "change.rejected"
  | "integration.connected"
  | "integration.disconnected"
  | "notification.retry_requested"
  | "admin.job.triggered"
  | "admin.simulation.started"
  | "service_role.used"
  /** Legacy / transitional */
  | "auth.login_failed"
  | "integration.sync_started"
  | "integration.sync_failed"
  | "admin.job_run"
  | "privileged.service_role_used";

export type AuditAction = Phase0AuditAction | (string & {});

export class AuditLogRequiredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuditLogRequiredError";
  }
}
