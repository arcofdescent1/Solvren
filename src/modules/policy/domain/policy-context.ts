/**
 * Phase 3 — Policy evaluation context (§7).
 */
import type { AutonomyMode } from "./policy-decision";

export type PolicyEvaluationContext = {
  orgId: string;
  environment: "production" | "staging" | "sandbox" | "demo" | "internal";

  issueId?: string;
  findingId?: string;

  issueFamily?: string;
  detectorKey?: string;
  playbookKey?: string;
  workflowStepKey?: string;

  actionKey?: string;
  provider?: string;
  integrationId?: string;

  primaryEntityType?: string;
  primaryEntityId?: string;

  severity?: "low" | "medium" | "high" | "critical";
  priorityBand?: "P1" | "P2" | "P3" | "P4" | null;

  riskLevel?: "low" | "medium" | "high" | "critical";
  impactAmount?: number | null;
  currencyCode?: string | null;
  confidenceScore?: number | null;

  actorUserId?: string | null;
  actorRoles?: string[];
  requestedMode?: AutonomyMode;

  metadata?: Record<string, unknown>;
};
