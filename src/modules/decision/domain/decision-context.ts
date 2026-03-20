/**
 * Phase 5 — Decision context contract (§8).
 */
export type DecisionContext = {
  orgId: string;
  environment: "production" | "staging" | "sandbox" | "demo" | "internal";

  issueId?: string;
  findingId?: string;
  workflowRunId?: string;
  workflowStepKey?: string;

  issueFamily?: string;
  detectorKey?: string;
  playbookKey?: string;

  severity?: "low" | "medium" | "high" | "critical";
  priorityBand?: "P1" | "P2" | "P3" | "P4" | null;

  impactAmount?: number | null;
  impactScore?: number | null;
  confidenceScore?: number | null;

  primaryEntityType?: string | null;
  primaryEntityId?: string | null;

  evidenceSummary?: Record<string, unknown>;
  signalSummary?: Record<string, unknown>;
  actionHistorySummary?: Record<string, unknown>;

  requestedMode:
    | "manual_only"
    | "suggest_only"
    | "approve_then_execute"
    | "auto_execute_low_risk"
    | "auto_execute_policy_bounded"
    | "full_trusted_autonomy";

  candidateActionKeys: string[];
  metadata?: Record<string, unknown>;
};
