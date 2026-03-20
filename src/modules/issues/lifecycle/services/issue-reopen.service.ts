/**
 * Phase 1 — Reopen service: dedicated reopen flow from CLOSED.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { IssueLifecycleState, IssueLifecycleEventType } from "../domain";
import type { LifecycleContext } from "../domain/lifecycle-context";
import type { LifecycleValidationResult } from "../domain/lifecycle-validation";
import { insertLifecycleEvent } from "../repositories/issue-lifecycle-events.repository";
import { getTerminalClassification } from "../repositories/issue-terminal-classification.repository";

type IssueWithLifecycle = {
  id: string;
  org_id: string;
  lifecycle_state: string;
  lifecycle_version: number;
  reopen_count: number;
};

async function getIssueWithLifecycle(
  supabase: SupabaseClient,
  issueId: string
): Promise<{ data: IssueWithLifecycle | null; error: Error | null }> {
  const { data, error } = await supabase
    .from("issues")
    .select("id, org_id, lifecycle_state, lifecycle_version, reopen_count")
    .eq("id", issueId)
    .single();
  if (error) return { data: null, error: error as unknown as Error };
  return { data: data as IssueWithLifecycle, error: null };
}

export type ReopenIssuePayload = {
  expectedLifecycleVersion: number;
  reason: string;
  notes?: string;
};

export async function reopenIssue(
  supabase: SupabaseClient,
  issueId: string,
  payload: ReopenIssuePayload,
  context: LifecycleContext
): Promise<{ success: boolean; validation: LifecycleValidationResult; error?: Error }> {
  const { data: issue } = await getIssueWithLifecycle(supabase, issueId);
  if (!issue) {
    return {
      success: false,
      validation: { allowed: false, reasonCode: "invalid_transition", message: "Issue not found" },
    };
  }

  if (issue.lifecycle_state !== IssueLifecycleState.CLOSED) {
    return {
      success: false,
      validation: {
        allowed: false,
        reasonCode: "invalid_transition",
        message: "Can only reopen closed issues.",
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

  const { data: classification } = await getTerminalClassification(supabase, issueId);
  const priorClosePath = classification?.classification_type ?? "resolved_success";

  const newState =
    priorClosePath === "no_action_closed" ? IssueLifecycleState.IMPACT_ESTIMATED : IssueLifecycleState.ACTION_PLANNED;

  const { error: eventErr } = await insertLifecycleEvent(supabase, {
    org_id: issue.org_id,
    issue_id: issueId,
    event_type: IssueLifecycleEventType.ISSUE_REOPENED,
    from_state: IssueLifecycleState.CLOSED,
    to_state: newState,
    event_reason: payload.reason,
    event_payload_json: { notes: payload.notes ?? null },
    actor_type: context.actorType,
    actor_user_id: context.actorUserId ?? null,
    correlation_id: context.correlationId ?? null,
  });
  if (eventErr) return { success: false, validation: { allowed: true }, error: eventErr };

  const { data: upData, error: upErr } = await supabase
    .from("issues")
    .update({
      lifecycle_state: newState,
      lifecycle_version: issue.lifecycle_version + 1,
      reopen_count: issue.reopen_count + 1,
      closed_at: null,
      closed_by_user_id: null,
      terminal_reason: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", issueId)
    .eq("lifecycle_version", issue.lifecycle_version)
    .select("id")
    .maybeSingle();

  if (upErr) return { success: false, validation: { allowed: true }, error: upErr as unknown as Error };
  if (!upData?.id) {
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
