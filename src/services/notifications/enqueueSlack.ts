import type { SupabaseClient } from "@supabase/supabase-js";
import { enqueueSlackDelivery } from "@/services/slack/enqueueSlackDelivery";

export async function enqueueSlack(
  supabase: SupabaseClient,
  args: {
    orgId: string;
    kind: string;
    dedupeKey: string;
    method: "chat.postMessage" | "chat.update";
    methodArgs: Record<string, unknown>;
    meta?: Record<string, unknown>;
    changeEventId?: string | null;
    availableAt?: string | null;
  }
) {
  const {
    orgId,
    kind,
    dedupeKey,
    method,
    methodArgs,
    meta,
    changeEventId,
    availableAt,
  } = args;

  const payload: Record<string, unknown> = {
    method,
    args: methodArgs,
    ...(meta && Object.keys(meta).length > 0 ? { meta } : {}),
  };

  // IES: use slack_message_deliveries when org has Slack app installed
  const { data: install } = await supabase
    .from("slack_installations")
    .select("team_id")
    .eq("org_id", orgId)
    .eq("status", "ACTIVE")
    .maybeSingle();

  if (install?.team_id) {
    const channelId = (methodArgs.channel as string) ?? "";
    const destinationType = channelId.startsWith("D") ? "user_dm" : "channel";
    const { data: link } = await supabase
      .from("slack_workspace_links")
      .select("integration_connection_id")
      .eq("org_id", orgId)
      .maybeSingle();

    await enqueueSlackDelivery(supabase, {
      orgId,
      integrationConnectionId: (link as { integration_connection_id?: string } | null)
        ?.integration_connection_id ?? null,
      changeId: changeEventId ?? null,
      approvalId: (meta as { approvalId?: string })?.approvalId ?? null,
      messageType: kind,
      destinationType,
      destinationId: channelId || "unknown",
      payload: payload as { method: string; args: Record<string, unknown>; meta?: Record<string, unknown> },
      idempotencyKey: dedupeKey,
    });
    return;
  }

  // Legacy: notification_outbox when no Slack app
  const { error } = await supabase.from("notification_outbox").insert({
    org_id: orgId,
    change_event_id: changeEventId ?? null,
    channel: "SLACK",
    template_key: kind,
    payload,
    status: "PENDING",
    dedupe_key: dedupeKey,
    available_at: availableAt ?? new Date().toISOString(),
    attempt_count: 0,
  });

  if (error && !String(error.message ?? "").includes("duplicate key")) {
    throw new Error(error.message);
  }
}
