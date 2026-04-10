/**
 * Phase 1 — Central lifecycle service. All lifecycle mutations go through here.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { IssueLifecycleState, IssueLifecycleEventType } from "../domain";
import type { LifecycleContext } from "../domain/lifecycle-context";
import type { LifecycleValidationResult } from "../domain/lifecycle-validation";
import { insertLifecycleEvent } from "../repositories/issue-lifecycle-events.repository";
import { insertNoActionDecision, getNoActionDecision } from "../repositories/issue-no-action-decision.repository";
import { validateTransition } from "./issue-lifecycle-validator.service";
import { gatherLifecycleChecks } from "./lifecycle-checks";

export type IssueLifecycleView = {
  issueId: string;
  currentState: string;
  lifecycleVersion: number;
  reopenCount: number;
  terminalReason: string | null;
  closedAt: string | null;
  closedByUserId: string | null;
  events: Array<{
    eventType: string;
    fromState: string | null;
    toState: string | null;
    actorType: string;
    createdAt: string;
  }>;
};

type IssueWithLifecycle = {
  id: string;
  org_id: string;
  lifecycle_state: string;
  lifecycle_version: number;
  reopen_count: number;
  terminal_reason: string | null;
  closed_at: string | null;
  closed_by_user_id: string | null;
};

async function getIssueWithLifecycle(
  supabase: SupabaseClient,
  issueId: string
): Promise<{ data: IssueWithLifecycle | null; error: Error | null }> {
  const { data, error } = await supabase
    .from("issues")
    .select("id, org_id, lifecycle_state, lifecycle_version, reopen_count, terminal_reason, closed_at, closed_by_user_id")
    .eq("id", issueId)
    .single();
  if (error) return { data: null, error: error as unknown as Error };
  return { data: data as IssueWithLifecycle, error: null };
}

async function updateIssueLifecycle(
  supabase: SupabaseClient,
  issueId: string,
  update: {
    lifecycle_state?: string;
    lifecycle_version?: number;
    reopen_count?: number;
    terminal_reason?: string | null;
    closed_at?: string | null;
    closed_by_user_id?: string | null;
  },
  expectedVersion: number
): Promise<{ updated: boolean; error: Error | null }> {
  const { data, error } = await supabase
    .from("issues")
    .update({
      ...update,
      lifecycle_version: (update.lifecycle_version ?? expectedVersion) + 1,
      updated_at: new Date().toISOString(),
    })
    .eq("id", issueId)
    .eq("lifecycle_version", expectedVersion)
    .select("id")
    .maybeSingle();
  if (error) return { updated: false, error: error as unknown as Error };
  return { updated: (data?.id?.length ?? 0) > 0, error: null };
}

export async function getLifecycle(
  supabase: SupabaseClient,
  issueId: string
): Promise<{ data: IssueLifecycleView | null; error: Error | null }> {
  const { data: list } = await import("../repositories/issue-lifecycle-events.repository").then((m) =>
    m.listLifecycleEvents(supabase, issueId, { limit: 100 })
  );
  const { data: issue } = await getIssueWithLifecycle(supabase, issueId);
  if (!issue) return { data: null, error: new Error("Issue not found") };

  return {
    data: {
      issueId: issue.id,
      currentState: issue.lifecycle_state,
      lifecycleVersion: issue.lifecycle_version,
      reopenCount: issue.reopen_count,
      terminalReason: issue.terminal_reason,
      closedAt: issue.closed_at,
      closedByUserId: issue.closed_by_user_id,
      events: (list ?? []).map((e) => ({
        eventType: e.event_type,
        fromState: e.from_state,
        toState: e.to_state,
        actorType: e.actor_type,
        createdAt: e.created_at,
      })),
    },
    error: null,
  };
}

export async function transition(
  supabase: SupabaseClient,
  issueId: string,
  requestedToState: string,
  context: LifecycleContext
): Promise<{ success: boolean; validation: LifecycleValidationResult; error?: Error }> {
  const { data: issue } = await getIssueWithLifecycle(supabase, issueId);
  if (!issue) {
    return {
      success: false,
      validation: { allowed: false, reasonCode: "invalid_transition", message: "Issue not found" },
    };
  }

  const checks = await gatherLifecycleChecks(supabase, issueId);
  const validation = await validateTransition(supabase, issueId, issue.org_id, issue.lifecycle_state, requestedToState, {
    hasImpactAttempt: checks.hasImpactAttempt,
    hasActionPlan: checks.hasActionAttempt,
    hasActionAttempt: checks.hasActionAttempt,
    hasVerificationAttempt: checks.hasVerificationAttempt,
    hasTerminalClassification: checks.hasTerminalClassification,
    hasNoActionDecision: checks.hasNoActionDecision,
    actualLifecycleVersion: issue.lifecycle_version,
  });

  if (!validation.allowed) return { success: false, validation };

  const eventType = mapTransitionToEventType(issue.lifecycle_state, requestedToState);

  const { error: eventErr } = await insertLifecycleEvent(supabase, {
    org_id: issue.org_id,
    issue_id: issueId,
    event_type: eventType,
    from_state: issue.lifecycle_state,
    to_state: requestedToState,
    event_reason: context.eventReason ?? null,
    event_payload_json: context.eventPayload ?? {},
    actor_type: context.actorType,
    actor_user_id: context.actorUserId ?? null,
    correlation_id: context.correlationId ?? null,
  });
  if (eventErr) return { success: false, validation: { allowed: true }, error: eventErr };

  const { updated, error: updateErr } = await updateIssueLifecycle(
    supabase,
    issueId,
    { lifecycle_state: requestedToState },
    issue.lifecycle_version
  );
  if (updateErr) return { success: false, validation: { allowed: true }, error: updateErr };
  if (!updated) {
    return {
      success: false,
      validation: {
        allowed: false,
        reasonCode: "lifecycle_version_conflict",
        message: "Lifecycle version conflict; please refresh and retry.",
      },
    };
  }

  return { success: true, validation: { allowed: true } };
}

function mapTransitionToEventType(from: string, to: string): string {
  if (to === IssueLifecycleState.IMPACT_ESTIMATED) return IssueLifecycleEventType.IMPACT_ESTIMATION_RECORDED;
  if (to === IssueLifecycleState.ACTION_PLANNED) return IssueLifecycleEventType.ACTION_PLAN_CREATED;
  if (to === IssueLifecycleState.ACTION_EXECUTED) return IssueLifecycleEventType.ACTION_EXECUTION_RECORDED;
  if (to === IssueLifecycleState.VERIFICATION_PENDING) return IssueLifecycleEventType.VERIFICATION_REQUESTED;
  if (to === IssueLifecycleState.VERIFIED_SUCCESS) return IssueLifecycleEventType.VERIFICATION_COMPLETED_SUCCESS;
  if (to === IssueLifecycleState.VERIFIED_FAILURE) return IssueLifecycleEventType.VERIFICATION_COMPLETED_FAILURE;
  if (to === IssueLifecycleState.NO_ACTION_TAKEN) return IssueLifecycleEventType.NO_ACTION_DECISION_RECORDED;
  return "LIFECYCLE_STATE_CHANGE";
}

export async function recordImpact(
  supabase: SupabaseClient,
  issueId: string,
  _payload: Record<string, unknown>,
  context: LifecycleContext
): Promise<{ success: boolean; validation: LifecycleValidationResult }> {
  return transition(supabase, issueId, IssueLifecycleState.IMPACT_ESTIMATED, context);
}

export async function recordActionPlan(
  supabase: SupabaseClient,
  issueId: string,
  _payload: Record<string, unknown>,
  context: LifecycleContext
): Promise<{ success: boolean; validation: LifecycleValidationResult }> {
  return transition(supabase, issueId, IssueLifecycleState.ACTION_PLANNED, context);
}

export async function recordActionExecution(
  supabase: SupabaseClient,
  issueId: string,
  _payload: Record<string, unknown>,
  context: LifecycleContext
): Promise<{ success: boolean; validation: LifecycleValidationResult }> {
  return transition(supabase, issueId, IssueLifecycleState.ACTION_EXECUTED, context);
}

export async function recordVerificationResult(
  supabase: SupabaseClient,
  issueId: string,
  result: "success" | "failure",
  _payload: Record<string, unknown>,
  context: LifecycleContext
): Promise<{ success: boolean; validation: LifecycleValidationResult }> {
  const toState =
    result === "success" ? IssueLifecycleState.VERIFIED_SUCCESS : IssueLifecycleState.VERIFIED_FAILURE;
  return transition(supabase, issueId, toState, context);
}

export async function recordNoActionDecision(
  supabase: SupabaseClient,
  issueId: string,
  payload: { reason: string; notes?: string; requiresApproval?: boolean; approvedByUserId?: string | null },
  context: LifecycleContext
): Promise<{ success: boolean; validation: LifecycleValidationResult }> {
  const { data: issue } = await getIssueWithLifecycle(supabase, issueId);
  if (!issue) {
    return {
      success: false,
      validation: { allowed: false, reasonCode: "invalid_transition", message: "Issue not found" },
    };
  }

  const { data: existing } = await getNoActionDecision(supabase, issueId);
  if (existing) {
    return {
      success: false,
      validation: {
        allowed: false,
        reasonCode: "duplicate_no_action_decision",
        message: "No-action decision already recorded for this issue.",
      },
    };
  }

  const { error: insertErr } = await insertNoActionDecision(supabase, {
    org_id: issue.org_id,
    issue_id: issueId,
    no_action_reason: payload.reason as import("../domain").NoActionReason,
    no_action_notes: payload.notes ?? null,
    requires_approval: payload.requiresApproval ?? false,
    approved_by_user_id: payload.approvedByUserId ?? (payload.requiresApproval ? context.actorUserId : null),
    created_by_user_id: context.actorUserId ?? null,
  });
  if (insertErr) {
    return {
      success: false,
      validation: { allowed: false, message: insertErr.message },
    };
  }

  return transition(supabase, issueId, IssueLifecycleState.NO_ACTION_TAKEN, {
    ...context,
    eventPayload: { ...context.eventPayload, reason: payload.reason },
  });
}
