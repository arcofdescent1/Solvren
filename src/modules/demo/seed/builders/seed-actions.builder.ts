/**
 * Phase 8 — Actions seed builder.
 */
import { ts, seededUuid } from "./seed-helpers";

type IssueActionInsert = Record<string, unknown>;

export type SeedActionInput = {
  orgId: string;
  issueId: string;
  issueKey: string;
  actionType: string;
  actionStatus: "pending" | "completed" | "failed";
  daysAgo?: number;
};

export function buildSeedActions(input: SeedActionInput[]): IssueActionInsert[] {
  return input.map((a, idx) => {
    const daysAgo = a.daysAgo ?? 2;
    const actionId = seededUuid(`action:${a.orgId}:${a.issueKey}:${a.actionType}:${idx}`);

    return {
      id: actionId,
      issue_id: a.issueId,
      action_type: a.actionType,
      action_status: a.actionStatus,
      external_system: "stripe",
      target_ref: `inv_${a.issueKey.slice(-8)}`,
      request_json: { demo: true } as unknown as Record<string, unknown>,
      response_json: a.actionStatus === "completed" ? { success: true } : undefined,
      created_at: ts(-daysAgo),
      executed_at: a.actionStatus !== "pending" ? ts(-daysAgo, 1) : undefined,
    } as IssueActionInsert;
  });
}
