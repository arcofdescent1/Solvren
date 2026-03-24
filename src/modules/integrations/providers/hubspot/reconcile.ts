/**
 * Phase 4 — HubSpot reconcile: incremental fetch of changed records.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { getHubSpotClientForOrg } from "./hubspotClientForOrg";
import { phase4WebhookIntake } from "../../webhooks/phase4WebhookIntake";

export type HubSpotReconcileResult =
  | { ok: true; recordsFetched: number; eventsIngested: number }
  | { ok: false; error: string };

export async function runHubSpotReconcile(
  supabase: SupabaseClient,
  input: { orgId: string; integrationAccountId: string }
): Promise<HubSpotReconcileResult> {
  const result = await getHubSpotClientForOrg(input.orgId);
  if (!result) return { ok: false, error: "HubSpot not connected" };

  let recordsFetched = 0;
  let eventsIngested = 0;

  try {
    const objectTypes = ["contacts", "companies", "deals"] as const;

    for (const objType of objectTypes) {
      const { results } = await result.client.searchCrmObjects(objType, {
        limit: 50,
        sorts: [{ propertyName: "hs_lastmodifieddate", direction: "DESCENDING" }],
      });

      for (const item of results ?? []) {
        recordsFetched++;
        const rec = item as Record<string, unknown>;
        const id = rec.id as string;
        const lastmod = rec.lastmodifieddate ?? rec.hs_lastmodifieddate ?? rec.createdate ?? Date.now();

        const intakeResult = await phase4WebhookIntake(supabase, {
          provider: "hubspot",
          orgId: input.orgId,
          integrationAccountId: input.integrationAccountId,
          sourceChannel: "reconcile",
          externalEventId: `reconcile-${objType}-${id}-${lastmod}`,
          externalObjectType: objType,
          externalObjectId: id,
          eventType: `${objType}.propertyChange`,
          eventTime: typeof lastmod === "number" ? new Date(lastmod).toISOString() : new Date().toISOString(),
          payload: rec,
        });

        if (intakeResult.ok && !intakeResult.duplicate) eventsIngested++;
      }
    }

    return { ok: true, recordsFetched, eventsIngested };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "HubSpot reconcile failed" };
  }
}
