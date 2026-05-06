import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { shouldNotifyIssuePhase3 } from "@/lib/issues/issueNotifyEligibility";

/**
 * Dedupe key = stable issue id + notification family + hash of canonical payload.
 * Aligns with migration 211 comment on `notification_outbox.dedupe_key`.
 */
export function issueNotificationDedupeKey(args: {
  issueId: string;
  notificationType: string;
  payload: unknown;
}): string {
  const payloadHash = createHash("sha256")
    .update(JSON.stringify(args.payload))
    .digest("hex")
    .slice(0, 48);
  return `issue:${args.issueId}:${args.notificationType}:${payloadHash}`;
}

/** Insert into `notification_outbox`; ignores duplicate `dedupe_key` (unique index). */
export async function enqueueIssueOutboxDeduped(
  admin: SupabaseClient,
  args: {
    orgId: string;
    issueId: string;
    notificationType: string;
    channel: string;
    templateKey: string;
    payload: Record<string, unknown>;
    recipient?: string | null;
    nextAttemptAt?: string;
    changeEventId?: string | null;
  }
): Promise<{ inserted: boolean }> {
  const dedupe_key = issueNotificationDedupeKey({
    issueId: args.issueId,
    notificationType: args.notificationType,
    payload: args.payload,
  });
  const when = args.nextAttemptAt ?? new Date().toISOString();

  if (
    (args.channel === "SLACK" || args.channel === "EMAIL") &&
    args.issueId
  ) {
    const { data: issueRow } = await admin
      .from("issues")
      .select("priority_band, noise_score, suppressed_until")
      .eq("id", args.issueId)
      .maybeSingle();
    if (
      issueRow &&
      !shouldNotifyIssuePhase3(issueRow as { priority_band?: string | null; noise_score?: number | null; suppressed_until?: string | null })
    ) {
      return { inserted: false };
    }
  }

  const { error } = await admin.from("notification_outbox").insert({
    org_id: args.orgId,
    change_event_id: args.changeEventId ?? null,
    issue_id: args.issueId,
    notification_type: args.notificationType,
    recipient: args.recipient ?? null,
    channel: args.channel,
    template_key: args.templateKey,
    payload: args.payload,
    dedupe_key,
    status: "PENDING",
    available_at: when,
    next_attempt_at: when,
    attempt_count: 0,
  });
  if (error) {
    if (/duplicate key/i.test(error.message)) return { inserted: false };
    throw new Error(error.message);
  }
  return { inserted: true };
}
