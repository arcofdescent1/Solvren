/**
 * Phase 1 — HubSpot contacts + deals → raw_events (paginated).
 */
import { createHash } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { HubSpotClient } from "@/services/hubspot/HubSpotClient";
import { upsertNormalizedRawEvent } from "../upsertNormalizedRawEvent";
import { ensureHubSpotAccessTokenForOrg } from "./ensureHubSpotAccess";

function emailNormHash(email: string): string | null {
  const e = email.trim().toLowerCase();
  if (!e) return null;
  return createHash("sha256").update(e, "utf8").digest("hex");
}

const CONTACT_PROPS = [
  "email",
  "lifecyclestage",
  "createdate",
  "firstname",
  "lastname",
  "hs_last_sales_activity_timestamp",
  "notes_last_contacted",
  "num_associated_deals",
  "lastmodifieddate",
];

const DEAL_PROPS = [
  "dealname",
  "dealstage",
  "amount",
  "closedate",
  "hs_lastmodifieddate",
  "hs_is_closed",
  "pipeline",
];

function redactContact(id: string, props: Record<string, unknown>): Record<string, unknown> {
  const raw = String(props.email ?? "").trim();
  return {
    id,
    email_norm_hash: emailNormHash(raw),
    lifecyclestage: props.lifecyclestage ?? null,
    createdate: props.createdate ?? null,
    hs_last_sales_activity_timestamp: props.hs_last_sales_activity_timestamp ?? null,
    notes_last_contacted: props.notes_last_contacted ?? null,
    num_associated_deals: props.num_associated_deals ?? null,
    lastmodifieddate: props.lastmodifieddate ?? null,
  };
}

function redactDeal(id: string, props: Record<string, unknown>): Record<string, unknown> {
  return {
    id,
    dealname: props.dealname ? "[redacted]" : "Deal",
    dealstage: props.dealstage ?? null,
    amount: props.amount ?? null,
    hs_lastmodifieddate: props.hs_lastmodifieddate ?? null,
    hs_is_closed: props.hs_is_closed ?? null,
  };
}

export async function ingestHubSpotForOrg(
  supabase: SupabaseClient,
  orgId: string
): Promise<{ ok: true; wrote: number } | { ok: false; error: string }> {
  const tok = await ensureHubSpotAccessTokenForOrg(supabase, orgId);
  if (!tok.ok) return { ok: false, error: tok.error };

  const client = new HubSpotClient({ accessToken: tok.accessToken });
  let wrote = 0;

  try {
    let after: string | undefined;
    do {
      const page = await client.listContactsPage({
        limit: 100,
        after,
        properties: CONTACT_PROPS,
      });
      for (const row of page.results ?? []) {
        const r = row as { id?: string; properties?: Record<string, unknown> };
        const id = r.id ?? "";
        if (!id) continue;
        const props = r.properties ?? {};
        const occurred =
          (props.hs_last_sales_activity_timestamp as string) ??
          (props.lastmodifieddate as string) ??
          new Date().toISOString();
        const res = await upsertNormalizedRawEvent(supabase, {
          orgId,
          provider: "hubspot",
          sourceChannel: "incremental_sync",
          externalId: `contact:${id}`,
          eventType: "hubspot_contact",
          occurredAt: new Date(occurred).toISOString(),
          payload: redactContact(id, props),
        });
        if (res.ok) wrote += 1;
      }
      after = page.paging?.next?.after;
    } while (after);

    after = undefined;
    do {
      const page = await client.listDealsPage({
        limit: 100,
        after,
        properties: DEAL_PROPS,
      });
      for (const row of page.results ?? []) {
        const r = row as { id?: string; properties?: Record<string, unknown> };
        const id = r.id ?? "";
        if (!id) continue;
        const props = r.properties ?? {};
        const occurred = (props.hs_lastmodifieddate as string) ?? new Date().toISOString();
        const res = await upsertNormalizedRawEvent(supabase, {
          orgId,
          provider: "hubspot",
          sourceChannel: "incremental_sync",
          externalId: `deal:${id}`,
          eventType: "hubspot_deal",
          occurredAt: new Date(occurred).toISOString(),
          payload: redactDeal(id, props),
        });
        if (res.ok) wrote += 1;
      }
      after = page.paging?.next?.after;
    } while (after);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "hubspot_ingest_failed" };
  }

  await supabase
    .from("integration_connections")
    .update({
      last_synced_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("org_id", orgId)
    .eq("provider", "hubspot");

  return { ok: true, wrote };
}
