/**
 * Phase 6 Deep Expansion — Execution contracts (§14).
 * DETECT → QUANTIFY → ROUTE → EXECUTE → VERIFY
 */

export type ActionType = "read" | "write" | "workflow";
export type RiskLevel = "low" | "medium" | "high" | "critical";
export type ExecutionMode = "manual" | "suggested" | "auto";
export type IdempotencyStrategy = "safe" | "unsafe" | "conditional";
export type AuditLevel = "standard" | "strict";

export type ActionInput = {
  key: string;
  label: string;
  type: "string" | "number" | "boolean" | "json";
  required?: boolean;
  description?: string;
};

/** Action categories for productized intelligence. */
export type ActionCategory =
  | "revenue_recovery"
  | "funnel_recovery"
  | "data_repair"
  | "change_governance";

/** Full action definition contract — mandatory for all actions. */
export interface ActionDefinition {
  actionKey: string;
  displayName: string;
  description: string;
  provider: string;
  entityType: string;
  actionType: ActionType;
  riskLevel: RiskLevel;
  requiredInputs: ActionInput[];
  optionalInputs: ActionInput[];
  supportsBulk: boolean;
  requiresApproval: boolean;
  executionMode: ExecutionMode;
  idempotencyStrategy: IdempotencyStrategy;
  sideEffects: string[];
  successCriteria: string[];
  failureModes: string[];
  rollbackSupported: boolean;
  auditLevel: AuditLevel;
  version: string;
  category: ActionCategory;
}

export type EntityRef = {
  externalSystem: string;
  externalId: string;
  entityType?: string;
};

/** Execution request contract. */
export interface ActionExecutionRequest {
  actionKey: string;
  orgId: string;
  issueId: string;
  targetEntities: EntityRef[];
  inputs: Record<string, unknown>;
  executionMode: ExecutionMode;
  requestedBy: string;
  idempotencyKey?: string;
}

/** Execution result contract. */
export interface ActionExecutionResult {
  status: "success" | "partial" | "failed";
  providerResponse?: unknown;
  affectedRecords: number;
  verificationPending: boolean;
  externalId?: string;
  error?: {
    code: string;
    message: string;
  };
}

export type WritebackStatus =
  | "pending"
  | "executing"
  | "success"
  | "partial_success"
  | "failed"
  | "retrying"
  | "verified";

/** Approval policy for guardrails. */
export interface ApprovalPolicy {
  riskLevelThreshold: RiskLevel;
  requiresHuman: boolean;
  allowedActions: string[];
  blockedActions: string[];
}
