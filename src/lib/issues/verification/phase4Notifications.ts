/**
 * Phase 4 — outbox notifications with per-issue per-type per-day dedupe (UTC day).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { enqueueIssueOutboxDeduped } from "@/services/notifications/issueOutboxDedupe";

function utcDayKey(d = new Date()) {
  return d.toISOString().slice(0, 10);
}

export type Phase4NotificationKind = "issue_verified" | "roi_generated" | "regression_detected";

export async function enqueuePhase4IssueNotification(
  admin: SupabaseClient,
  args: {
    orgId: string;
    issueId: string;
    kind: Phase4NotificationKind;
    payload: Record<string, unknown>;
  }
): Promise<void> {
  const { data: iss } = await admin
    .from("issues")
    .select("suppressed_until")
    .eq("id", args.issueId)
    .maybeSingle();
  const sup = (iss as { suppressed_until?: string | null } | null)?.suppressed_until;
  if (sup && Date.parse(sup) > Date.now()) return;

  const day = utcDayKey();
  const dedupePayload = { ...args.payload, day };
  await enqueueIssueOutboxDeduped(admin, {
    orgId: args.orgId,
    issueId: args.issueId,
    notificationType: args.kind,
    channel: "IN_APP",
    templateKey: args.kind,
    payload: dedupePayload,
  });
}
