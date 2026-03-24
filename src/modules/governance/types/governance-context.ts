/**
 * Phase 5 — Single governance evaluation contract for all governed journeys.
 */
export type GovernanceEnvironment = "dev" | "staging" | "prod";

export type GovernanceActorType = "user" | "system" | "automation";

export type GovernanceResourceType =
  | "integration_action"
  | "change"
  | "issue"
  | "playbook_step"
  | "evidence_waiver";

export type GovernanceAutonomyMode = "MANUAL" | "SUGGESTED" | "ASSISTED" | "AUTO";

export type GovernanceEvaluationContext = {
  orgId: string;
  environment: GovernanceEnvironment;
  actor: {
    userId?: string;
    actorType: GovernanceActorType;
    roleKeys?: string[];
  };
  target: {
    resourceType: GovernanceResourceType;
    resourceId?: string;
    actionKey?: string;
    transitionKey?: string;
    provider?: string;
    integrationKey?: string;
  };
  issue?: {
    issueId?: string;
    severity?: string;
    impactAmount?: number;
    tags?: string[];
    confidence?: number;
  };
  change?: {
    changeId?: string;
    domain?: string;
    riskLevel?: string;
    environment?: string;
  };
  controls?: {
    legalHold?: boolean;
    financeHold?: boolean;
    hasRequiredEvidence?: boolean;
  };
  autonomy?: {
    requestedMode?: GovernanceAutonomyMode;
  };
  /** Forward-compatible bag; prefer typed fields above. */
  extensions?: Record<string, unknown>;
};
