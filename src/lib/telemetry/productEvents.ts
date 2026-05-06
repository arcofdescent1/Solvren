import * as Sentry from "@sentry/nextjs";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Phase 5 — single canonical list. All product logging must use these names.
 */
export const PRODUCT_EVENTS = [
  "integration_connected",
  "integration_sync",

  "detection_run",
  "issue_created",
  "issue_updated",
  "issue_action",
  "issue_resolved",

  "verification_run",
  "issue_verified",
  "roi_generated",
  "regression_detected",

  "notification_sent",
  "notification_failed",

  "onboarding_step_completed",
] as const;

export type ProductEventName = (typeof PRODUCT_EVENTS)[number];

export type LogProductEventInput = {
  event: ProductEventName;
  orgId: string;
  userId?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  /** Legacy: issues stay addressable via issue_id */
  issueId?: string | null;
  metadata?: Record<string, unknown>;
};

function isProductEventName(s: string): s is ProductEventName {
  return (PRODUCT_EVENTS as readonly string[]).includes(s);
}

/**
 * Inserts one row into product_event_log. Does not throw; on failure reports to Sentry once.
 * Callers may void this (fire-and-forget) to avoid blocking the main flow.
 */
export async function logProductEvent(
  _supabase: SupabaseClient,
  input: LogProductEventInput
): Promise<void> {
  const name = input.event;
  if (!isProductEventName(String(name))) {
    Sentry.captureMessage(`logProductEvent: non-canonical event ${String(name)}`, { level: "warning" });
  }
  try {
    const admin = createAdminClient();
    const { error } = await admin.from("product_event_log").insert({
      org_id: input.orgId,
      event_name: name,
      issue_id: input.issueId ?? null,
      entity_type: input.entityType ?? null,
      entity_id: input.entityId ?? null,
      actor_user_id: input.userId ?? null,
      metadata: {
        event: name,
        org_id: input.orgId,
        ...(input.metadata ?? {}),
      },
    });
    if (error) throw new Error(error.message);
  } catch (e) {
    Sentry.captureException(e instanceof Error ? e : new Error(String(e)), {
      tags: { product_event: String(name) },
      extra: { orgId: input.orgId },
    });
  }
}

/** Fire-and-forget wrapper for hot paths. */
export function logProductEventAsync(supabase: SupabaseClient, input: LogProductEventInput): void {
  void logProductEvent(supabase, input);
}
