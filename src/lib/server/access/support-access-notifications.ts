/**
 * Phase 4 — customer-visible notifications for support / break-glass (sanitized text only).
 */
import type { SupabaseClient } from "@supabase/supabase-js";

const MAX_REASON_LEN = 120;

export function sanitizeSupportAccessReason(raw: string): string {
  const t = raw.replace(/\s+/g, " ").trim().slice(0, MAX_REASON_LEN);
  if (!t) return "Support access event";
  return t.replace(/[<>]/g, "");
}

export async function notifyOrgSupportAccessEvent(
  admin: SupabaseClient,
  orgId: string,
  payload: { title: string; body: string; dedupeKey: string },
): Promise<void> {
  const { error } = await admin.from("notification_outbox").insert({
    org_id: orgId,
    change_event_id: null,
    channel: "IN_APP",
    template_key: "alert",
    payload: { title: payload.title, body: payload.body, kind: "support_access" },
    status: "PENDING",
    attempt_count: 0,
    last_error: null,
    available_at: new Date().toISOString(),
    dedupe_key: payload.dedupeKey,
  });
  if (error) {
    console.warn("[notifyOrgSupportAccessEvent]", error.message);
  }
}
