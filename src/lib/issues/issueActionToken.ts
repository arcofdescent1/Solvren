import { createHash, randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { IssueWorkflowActionType } from "./executeIssueWorkflowAction";

const DEFAULT_TTL_HOURS = 72;

/** Phase 2 — store only SHA-256 hex of raw token (see migration 211). */
export function hashIssueActionToken(rawToken: string): string {
  return createHash("sha256").update(rawToken, "utf8").digest("hex");
}

export async function createIssueActionToken(
  admin: SupabaseClient,
  args: {
    orgId: string;
    issueId: string;
    actionType: IssueWorkflowActionType;
    recipientEmail?: string | null;
    ttlHours?: number;
  }
): Promise<{ rawToken: string } | null> {
  const rawToken = randomBytes(32).toString("hex");
  const token_hash = hashIssueActionToken(rawToken);
  const expires_at = new Date(
    Date.now() + (args.ttlHours ?? DEFAULT_TTL_HOURS) * 60 * 60 * 1000
  ).toISOString();

  const { error } = await admin.from("action_tokens").insert({
    org_id: args.orgId,
    issue_id: args.issueId,
    token_hash,
    action_type: args.actionType,
    recipient_email: args.recipientEmail ?? null,
    expires_at,
  });

  if (error) return null;
  return { rawToken };
}
