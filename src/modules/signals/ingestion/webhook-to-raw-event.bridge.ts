/**
 * Phase 3 — Bridge: persist webhook to raw_events before/alongside Phase 1 flow (§10, §23).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { intakeRawEvent } from "./raw-event-intake.service";
import type { SourceChannel } from "../domain/types";

export type WebhookToRawEventInput = {
  orgId: string;
  integrationAccountId?: string | null;
  provider: string;
  sourceChannel?: SourceChannel | string;
  externalEventId?: string | null;
  externalObjectType?: string | null;
  externalObjectId?: string | null;
  eventType: string;
  eventTime?: string | null;
  payload: Record<string, unknown>;
  headers?: Record<string, unknown> | null;
};

/** Persist webhook to raw_events. Use admin client for unauthenticated webhooks. */
export async function persistWebhookToRawEvents(
  supabase: SupabaseClient,
  input: WebhookToRawEventInput
): Promise<{ rawEventId: string; created: boolean } | { error: string }> {
  const result = await intakeRawEvent(supabase, {
    orgId: input.orgId,
    integrationAccountId: input.integrationAccountId ?? null,
    provider: input.provider,
    sourceChannel: (input.sourceChannel ?? "webhook") as SourceChannel,
    externalEventId: input.externalEventId ?? null,
    externalObjectType: input.externalObjectType ?? null,
    externalObjectId: input.externalObjectId ?? null,
    eventType: input.eventType,
    eventTime: input.eventTime ?? null,
    payload: input.payload,
    headers: input.headers ?? null,
  });

  if (!result.ok) return { error: result.error };
  return { rawEventId: result.rawEventId, created: result.created };
}
