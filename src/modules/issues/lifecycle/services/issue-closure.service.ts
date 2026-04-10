/**
 * Phase 1 — Closure service: validates closure invariant and closes issue.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { IssueLifecycleState, IssueLifecycleEventType } from "../domain";
import type { TerminalClassificationType } from "../domain";
import type { LifecycleContext } from "../domain/lifecycle-context";
import type { LifecycleValidationResult } from "../domain/lifecycle-validation";
import { insertLifecycleEvent } from "../repositories/issue-lifecycle-events.repository";
import { insertTerminalClassification } from "../repositories/issue-terminal-classification.repository";
import { validateClosureInvariant } from "./issue-lifecycle-validator.service";
import { gatherLifecycleChecks } from "./lifecycle-checks";

type IssueWithLifecycle = {
  id: string;
  org_id: string;
  lifecycle_state: string;
  lifecycle_version: number;
  closed_at: string | null;
  closed_by_user_id: string | null;
};

async function getIssueWithLifecycle(
  supabase: SupabaseClient,
  issueId: string
): Promise<{ data: IssueWithLifecycle | null; error: Error | null }> {
  const { data, error } = await supabase
    .from("issues")
    .select("id, org_id, lifecycle_state, lifecycle_version, closed_at, closed_by_user_id")
    .eq("id", issueId)
    .single();
  if (error) return { data: null, error: error as unknown as Error };
  return { data: data as IssueWithLifecycle, error: null };
}

async function updateIssueClosed(
  supabase: SupabaseClient,
  issueId: string,
  closedByUserId: string | null,
  expectedVersion: number
): Promise<{ updated: boolean; error: Error | null }> {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("issues")
    .update({
      lifecycle_state: IssueLifecycleState.CLOSED,
      lifecycle_version: expectedVersion + 1,
      closed_at: now,
      closed_by_user_id: closedByUserId,
      updated_at: now,
    })
    .eq("id", issueId)
    .eq("lifecycle_version", expectedVersion)
    .select("id")
    .maybeSingle();
  if (error) return { updated: false, error: error as unknown as Error };
  return { updated: (data?.id?.length ?? 0) > 0, error: null };
}

export type CloseIssuePayload = {
  expectedLifecycleVersion: number;
  terminalClassification: {
    classificationType: TerminalClassificationType;
    outcomeSummary: string;
    outcomePayload?: Record<string, unknown>;
  };
};

export async function closeIssue(
  supabase: SupabaseClient,
  issueId: string,
  payload: CloseIssuePayload,
  context: LifecycleContext
): Promise<{ success: boolean; validation: LifecycleValidationResult; error?: Error }> {
  const { data: issue } = await getIssueWithLifecycle(supabase, issueId);
  if (!issue) {
    return {
      success: false,
      validation: { allowed: false, reasonCode: "invalid_transition", message: "Issue not found" },
    };
  }

  if (issue.lifecycle_state === IssueLifecycleState.CLOSED) {
    return {
      success: false,
      validation: {
        allowed: false,
        reasonCode: "issue_already_closed",
        message: "Issue is already closed.",
      },
    };
  }

  if (payload.expectedLifecycleVersion !== issue.lifecycle_version) {
    return {
      success: false,
      validation: {
        allowed: false,
        reasonCode: "lifecycle_version_conflict",
        message: "Lifecycle version conflict; please refresh and retry.",
      },
    };
  }

  const validation = await validateClosureInvariant(
    supabase,
    issueId,
    issue.org_id,
    issue.lifecycle_state,
    {
      terminalClassification: payload.terminalClassification,
    }
  );

  if (!validation.allowed) return { success: false, validation };

  const { error: classErr } = await insertTerminalClassification(supabase, {
    org_id: issue.org_id,
    issue_id: issueId,
    classification_type: payload.terminalClassification.classificationType,
    outcome_summary: payload.terminalClassification.outcomeSummary,
    outcome_payload_json: payload.terminalClassification.outcomePayload ?? {},
    created_by_type: context.actorType === "user" ? "user" : "system",
    created_by_user_id: context.actorUserId ?? null,
  });
  if (classErr) return { success: false, validation: { allowed: true }, error: classErr };

  const { error: eventErr } = await insertLifecycleEvent(supabase, {
    org_id: issue.org_id,
    issue_id: issueId,
    event_type: IssueLifecycleEventType.TERMINAL_CLASSIFICATION_RECORDED,
    from_state: issue.lifecycle_state,
    to_state: issue.lifecycle_state,
    event_reason: context.eventReason ?? null,
    event_payload_json: { classification: payload.terminalClassification },
    actor_type: context.actorType,
    actor_user_id: context.actorUserId ?? null,
    correlation_id: context.correlationId ?? null,
  });
  if (eventErr) return { success: false, validation: { allowed: true }, error: eventErr };

  const { error: closeEventErr } = await insertLifecycleEvent(supabase, {
    org_id: issue.org_id,
    issue_id: issueId,
    event_type: IssueLifecycleEventType.ISSUE_CLOSED,
    from_state: issue.lifecycle_state,
    to_state: IssueLifecycleState.CLOSED,
    event_reason: context.eventReason ?? null,
    event_payload_json: { classification: payload.terminalClassification },
    actor_type: context.actorType,
    actor_user_id: context.actorUserId ?? null,
    correlation_id: context.correlationId ?? null,
  });
  if (closeEventErr) return { success: false, validation: { allowed: true }, error: closeEventErr };

  const { updated, error: updateErr } = await updateIssueClosed(
    supabase,
    issueId,
    context.actorUserId ?? null,
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

export async function getMissingClosureRequirements(
  supabase: SupabaseClient,
  issueId: string
): Promise<string[]> {
  const { data: issue } = await getIssueWithLifecycle(supabase, issueId);
  if (!issue) return [];
  const checks = await gatherLifecycleChecks(supabase, issueId);
  const { getMissingClosureRequirements: getMissing } = await import("./issue-lifecycle-validator.service");
  return getMissing(supabase, issueId, issue.org_id, issue.lifecycle_state, checks);
}
