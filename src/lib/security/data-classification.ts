/**
 * Phase 2 — Data classification for ingestion redaction.
 * PHI is treated as out-of-scope product data: paths classified PHI are dropped, not processed.
 */

export type DataSensitivity =
  | "PUBLIC"
  | "INTERNAL"
  | "CUSTOMER_CONFIDENTIAL"
  | "PII"
  | "FINANCIAL"
  | "SECRET"
  | "PHI";

export type DataHandlingRule = "ALLOW" | "HASH" | "REDACT" | "DROP" | "ENCRYPT";

export type FieldClassification = {
  sensitivity: DataSensitivity;
  handling: DataHandlingRule;
};

/** Default handling when sensitivity is known but per-field override absent. */
export const DEFAULT_RULES: Record<DataSensitivity, DataHandlingRule> = {
  PUBLIC: "ALLOW",
  INTERNAL: "ALLOW",
  CUSTOMER_CONFIDENTIAL: "REDACT",
  PII: "HASH",
  FINANCIAL: "ALLOW", // banding / minimization happens in per-integration normalize adapters
  SECRET: "DROP",
  PHI: "DROP",
};
