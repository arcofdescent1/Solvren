/**
 * Phase 4 — employee ↔ customer data access decisions.
 */

export type DataMaskingTier = "metadata" | "masked" | "sensitive";

export type LegalBasis = "metadata_default" | "grant" | "break_glass";

export type EmployeeDataRequestLevel = "metadata" | "masked" | "sensitive";

export type CustomerResourceType =
  | "organization"
  | "integration"
  | "issue"
  | "event"
  | "insight"
  | "audit_log"
  | "executive_dashboard"
  | "report";

export type AccessDecision = {
  allowed: boolean;
  dataMaskingTier: DataMaskingTier;
  legalBasis: LegalBasis;
  /** Audit: metadata | masked | sensitive | break_glass */
  accessType: "metadata" | "masked" | "sensitive" | "break_glass";
  /** Audit: tier_0 … tier_3 */
  accessLevel: "tier_0" | "tier_1" | "tier_2" | "tier_3";
  grantId?: string;
  breakGlassEventId?: string;
};

export type EmployeeAccessAuditInput = {
  orgId: string;
  employeeUserId: string;
  accessType: AccessDecision["accessType"];
  accessLevel: AccessDecision["accessLevel"];
  legalBasis: LegalBasis;
  resourceType: string;
  resourceId?: string | null;
  reason: string;
  grantId?: string | null;
  breakGlassEventId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
};
