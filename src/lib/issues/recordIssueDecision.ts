import type { SupabaseClient } from "@supabase/supabase-js";
import type { IssueWorkflowStatus } from "./issuePhase2Types";

export type DecisionSource = "solvren_app" | "slack" | "email" | "system";

export async function recordIssueDecision(
  supabase: SupabaseClient,
  input: {
    issueId: string;
    actionType: string;
    previousStatus: IssueWorkflowStatus;
    newStatus: IssueWorkflowStatus;
    source: DecisionSource;
    actorUserId: string | null;
    actorEmail: string | null;
    actorDisplayName: string | null;
    payload: Record<string, unknown>;
  }
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await supabase.from("issue_actions").insert({
    issue_id: input.issueId,
    action_type: input.actionType,
    action_status: "completed",
    requested_by: input.actorUserId,
    external_system: input.source,
    target_ref: null,
    request_json: input.payload,
    response_json: null,
    error_json: null,
    decision_source: input.source,
    actor_email: input.actorEmail,
    actor_display_name: input.actorDisplayName,
    previous_issue_status: input.previousStatus,
    new_issue_status: input.newStatus,
    decision_payload: input.payload,
    executed_at: new Date().toISOString(),
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
