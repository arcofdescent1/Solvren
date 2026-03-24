/**
 * Phase 4 — Stripe reconcile: fetch missed events via Events API.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { getStripeClientForOrg } from "./stripeClientForOrg";
import { phase4WebhookIntake } from "../../webhooks/phase4WebhookIntake";

export type StripeReconcileResult =
  | { ok: true; eventsFetched: number; eventsIngested: number }
  | { ok: false; error: string };

export async function runStripeReconcile(
  supabase: SupabaseClient,
  input: { orgId: string; integrationAccountId: string }
): Promise<StripeReconcileResult> {
  const stripe = await getStripeClientForOrg(input.orgId);
  if (!stripe) return { ok: false, error: "Stripe not connected" };

  const oneDayAgo = Math.floor((Date.now() - 24 * 60 * 60 * 1000) / 1000);
  let eventsFetched = 0;
  let eventsIngested = 0;

  try {
    let startingAfter: string | undefined;
    let hasMore = true;
    while (hasMore) {
      const resp = await stripe.events.list({
        created: { gte: oneDayAgo },
        limit: 100,
        ...(startingAfter && { starting_after: startingAfter }),
      });
      const events = resp.data ?? [];
      hasMore = resp.has_more ?? false;
      if (events.length > 0) {
        startingAfter = events[events.length - 1]?.id;
      }

      for (const evt of events) {
        eventsFetched++;
        const payload = evt as { id?: string; type?: string; data?: { object?: unknown }; created?: number };
        const obj = payload.data?.object ?? payload;
        const eventType = payload.type ?? "unknown";
        const objectType = (eventType.split(".")[0] ?? "unknown") as string;

        const result = await phase4WebhookIntake(supabase, {
          provider: "stripe",
          orgId: input.orgId,
          integrationAccountId: input.integrationAccountId,
          sourceChannel: "reconcile",
          externalEventId: payload.id,
          externalObjectType: objectType,
          externalObjectId: (obj as Record<string, unknown>)?.id as string,
          eventType,
          eventTime: payload.created ? new Date(payload.created * 1000).toISOString() : undefined,
          payload: obj as Record<string, unknown>,
        });

        if (result.ok && !result.duplicate) eventsIngested++;
      }
    }

    return { ok: true, eventsFetched, eventsIngested };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Stripe reconcile failed" };
  }
}
