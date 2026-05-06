/**
 * Phase 1 — Salesforce opportunities → raw_events (thin SOQL).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSalesforceClientForOrg } from "@/modules/integrations/providers/salesforce/salesforceClientForOrg";
import { upsertNormalizedRawEvent } from "../upsertNormalizedRawEvent";
import { getSalesforceOAuthRestContext, salesforceOAuthQuery } from "./oauthRest";

function redactOppRow(row: Record<string, unknown>): Record<string, unknown> {
  return {
    Id: row.Id,
    Name: row.Name ? "[redacted]" : null,
    Amount: row.Amount ?? null,
    StageName: row.StageName ?? null,
    LastModifiedDate: row.LastModifiedDate ?? null,
    OwnerId: row.OwnerId ?? null,
  };
}

export async function ingestSalesforceForOrg(
  supabase: SupabaseClient,
  orgId: string
): Promise<{ ok: true; wrote: number } | { ok: false; error: string }> {
  const q =
    "SELECT Id, Name, Amount, StageName, LastModifiedDate, OwnerId FROM Opportunity ORDER BY LastModifiedDate DESC LIMIT 500";

  let records: Record<string, unknown>[] = [];

  const oauth = await getSalesforceOAuthRestContext(supabase, orgId);
  if (oauth) {
    try {
      const res = await salesforceOAuthQuery<Record<string, unknown>>(oauth, q);
      records = res.records;
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "sf_soql_oauth_failed" };
    }
  } else {
    const client = await getSalesforceClientForOrg(orgId);
    if (!client) return { ok: false, error: "salesforce_not_connected" };
    try {
      const res = await client.executeSoql<Record<string, unknown>>(q);
      records = res.records;
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "sf_soql_failed" };
    }
  }

  let wrote = 0;
  for (const row of records) {
    const id = String(row.Id ?? "");
    if (!id) continue;
    const lm = String(row.LastModifiedDate ?? new Date().toISOString());
    const r = await upsertNormalizedRawEvent(supabase, {
      orgId,
      provider: "salesforce",
      sourceChannel: "incremental_sync",
      externalId: `opp:${id}`,
      eventType: "sf_opportunity",
      occurredAt: new Date(lm).toISOString(),
      payload: redactOppRow(row),
    });
    if (r.ok) wrote += 1;
  }

  await supabase
    .from("integration_connections")
    .update({
      last_synced_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("org_id", orgId)
    .eq("provider", "salesforce");

  return { ok: true, wrote };
}
