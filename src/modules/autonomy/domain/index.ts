/**
 * Phase 8 — Autonomy domain types.
 */

export type AutonomyMode =
  | "manual_only"
  | "suggest_only"
  | "approve_then_execute"
  | "auto_execute_low_risk"
  | "auto_execute_policy_bounded"
  | "full_trusted_autonomy";

export type RolloutState =
  | "off"
  | "simulate_only"
  | "observe_only"
  | "approval_required"
  | "bounded_auto"
  | "full_auto";

export type WorkflowRunStatus =
  | "queued"
  | "running"
  | "waiting_for_approval"
  | "paused"
  | "completed"
  | "failed"
  | "rolled_back"
  | "canceled";

export type StepRunStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "skipped"
  | "waiting"
  | "rolled_back";

export type StepType =
  | "decision"
  | "action"
  | "wait"
  | "approval"
  | "branch"
  | "verification"
  | "notification";

export type PolicyScope = "org" | "integration" | "action" | "playbook" | "issue_family" | "environment";

export type DecisionStatus = "advisory" | "approved" | "auto_executed" | "blocked" | "simulated";
