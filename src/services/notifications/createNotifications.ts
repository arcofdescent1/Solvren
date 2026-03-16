import type { SupabaseClient } from "@supabase/supabase-js";

export type EnqueueOptions = {
  orgId: string;
  changeEventId: string;
  templateKey: string;
  payload: Record<string, unknown>;
  /** Base for dedupe_key; will be suffixed with :{channel}. If omitted, no dedupe. */
  dedupeKeyBase?: string;
  /** If provided, only these channels; otherwise IN_APP only. */
  channels?: Array<"IN_APP" | "SLACK" | "EMAIL">;
  /** Extra payload merged into payload (e.g. channelId for Slack). */
  extraPayload?: Record<string, unknown>;
};

type OutboxRow = {
  org_id: string;
  change_event_id: string;
  channel: string;
  template_key: string;
  payload: Record<string, unknown>;
  status: string;
  attempt_count: number;
  last_error: string | null;
  available_at: string;
  dedupe_key: string | null;
};

/**
 * Enqueue notification events into notification_outbox.
 * Respects org settings for SLACK/EMAIL and dedupe keys to avoid spam.
 */
export async function enqueueNotificationEvents(
  db: SupabaseClient,
  options: EnqueueOptions
): Promise<{ inserted: number }> {
  const {
    orgId,
    changeEventId,
    templateKey,
    payload,
    dedupeKeyBase,
    channels: requestedChannels,
    extraPayload = {},
  } = options;

  const fullPayload = { ...payload, changeEventId, ...extraPayload };

  let channels: Array<"IN_APP" | "SLACK" | "EMAIL"> = requestedChannels ?? ["IN_APP"];
  if (requestedChannels == null && (templateKey === "daily_inbox" || templateKey === "weekly_digest")) {
    channels = ["IN_APP"];
  }

  if (channels.length > 1) {
    const { data: changeRow } = await db
      .from("change_events")
      .select("is_restricted")
      .eq("id", changeEventId)
      .maybeSingle();
    if (Boolean((changeRow as { is_restricted?: boolean | null } | null)?.is_restricted)) {
      channels = ["IN_APP"];
    }
  }

  if (channels.length > 1) {
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

    const hasSlack = Boolean(slackInstall?.default_channel_id ?? settings?.slack_enabled ?? settings?.slack_webhook_url);
    const hasEmail =
      Boolean(settings?.email_enabled) &&
      Array.isArray(settings?.notification_emails) &&
      settings.notification_emails.length > 0;

    channels = ["IN_APP"];
    if (hasSlack) channels.push("SLACK");
    if (hasEmail) channels.push("EMAIL");
  }

  const dedupeWindowMinutes = 60;
  const since = new Date(Date.now() - dedupeWindowMinutes * 60 * 1000).toISOString();
  const existingSet = new Set<string>();
  if (dedupeKeyBase) {
    const keys = channels.map((ch) => `${dedupeKeyBase}:${ch}`);
    const { data: existing } = await db
      .from("notification_outbox")
      .select("dedupe_key")
      .in("dedupe_key", keys)
      .gte("created_at", since);
    (existing ?? []).forEach((r) => {
      if (r.dedupe_key) existingSet.add(r.dedupe_key);
    });
  }

  const rows: OutboxRow[] = [];
  for (const ch of channels) {
    const dedupe_key = dedupeKeyBase ? `${dedupeKeyBase}:${ch}` : null;
    if (dedupe_key && existingSet.has(dedupe_key)) continue;

    rows.push({
      org_id: orgId,
      change_event_id: changeEventId,
      channel: ch,
      template_key: templateKey,
      payload: fullPayload,
      status: "PENDING",
      attempt_count: 0,
      last_error: null,
      available_at: new Date().toISOString(),
      dedupe_key,
    });
  }

  if (rows.length === 0) return { inserted: 0 };

  const { error } = await db.from("notification_outbox").insert(rows);
  if (error) {
    console.warn("[createNotifications] insert failed:", error.message);
    return { inserted: 0 };
  }
  return { inserted: rows.length };
}
