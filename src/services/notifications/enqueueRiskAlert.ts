/**
 * Hero Workflow 2 — Enqueue risk alert notifications (Slack, Email, IN_APP).
 * "High Risk Change Detected - $400k pricing modification without approval"
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export type RiskAlertPayload = {
  riskEventId: string;
  riskAlertId: string;
  provider: string;
  riskType: string;
  riskBucket: string;
  impactAmount?: number | null;
  object?: string;
  objectId?: string;
};

export async function enqueueRiskAlertNotifications(
  db: SupabaseClient,
  orgId: string,
  payload: RiskAlertPayload
): Promise<{ inserted: number }> {
  const { data: settings } = await db
    .from("organization_settings")
    .select("slack_enabled, slack_webhook_url, email_enabled, notification_emails")
    .eq("org_id", orgId)
    .maybeSingle();

  const { data: slackInstall } = await db
    .from("slack_installations")
    .select("default_channel_id")
    .eq("org_id", orgId)
    .maybeSingle();

  const channels: Array<"IN_APP" | "SLACK" | "EMAIL"> = ["IN_APP"];
  if (slackInstall?.default_channel_id || settings?.slack_enabled || settings?.slack_webhook_url) {
    channels.push("SLACK");
  }
  if (
    settings?.email_enabled &&
    Array.isArray(settings?.notification_emails) &&
    settings.notification_emails.length > 0
  ) {
    channels.push("EMAIL");
  }

  const dedupeBase = `risk_alert:${orgId}:${payload.riskEventId}`;
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { data: existing } = await db
    .from("notification_outbox")
    .select("dedupe_key")
    .in(
      "dedupe_key",
      channels.map((ch) => `${dedupeBase}:${ch}`)
    )
    .gte("created_at", since);

  const existingSet = new Set((existing ?? []).map((r) => r.dedupe_key).filter(Boolean));

  const fullPayload = {
    ...payload,
    changeEventId: null,
  };

  const rows = channels
    .map((ch) => {
      const dedupe_key = `${dedupeBase}:${ch}`;
      if (existingSet.has(dedupe_key)) return null;
      return {
        org_id: orgId,
        change_event_id: null,
        channel: ch,
        template_key: "high_risk_change_detected",
        payload: fullPayload,
        status: "PENDING",
        attempt_count: 0,
        last_error: null,
        available_at: new Date().toISOString(),
        dedupe_key,
      };
    })
    .filter((r): r is NonNullable<typeof r> => r != null);

  if (rows.length === 0) return { inserted: 0 };

  const { error } = await db.from("notification_outbox").insert(rows);
  if (error) {
    console.warn("[enqueueRiskAlert] insert failed:", error.message);
    return { inserted: 0 };
  }
  return { inserted: rows.length };
}
