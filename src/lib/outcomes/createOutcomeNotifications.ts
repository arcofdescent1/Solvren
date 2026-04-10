import type { SupabaseClient } from "@supabase/supabase-js";
import type { OutcomeThresholdEvent } from "@/lib/outcomes/evaluateOutcomeThresholds";

type OutboxInsert = {
  org_id: string;
  change_event_id: string | null;
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
 * Fan-out outcome threshold notifications (IN_APP); dedupe via notification_outbox unique index.
 */
export async function createOutcomeNotifications(
  admin: SupabaseClient,
  orgId: string,
  events: OutcomeThresholdEvent[]
): Promise<{ inserted: number }> {
  let inserted = 0;
  for (const ev of events) {
    const dedupe_key = `${ev.dedupeKeyBase}:IN_APP`;
    const row: OutboxInsert = {
      org_id: orgId,
      change_event_id: null,
      channel: "IN_APP",
      template_key: "outcomes_threshold",
      payload: {
        headline: ev.headline,
        body: ev.body,
        thresholdType: ev.thresholdType,
        orgId,
      },
      status: "PENDING",
      attempt_count: 0,
      last_error: null,
      available_at: new Date().toISOString(),
      dedupe_key,
    };
    const { error } = await admin.from("notification_outbox").insert(row);
    if (error) {
      if (!String(error.message).toLowerCase().includes("duplicate")) {
         
        console.warn("outcome notification insert:", error.message);
      }
      continue;
    }
    inserted += 1;
  }
  return { inserted };
}
