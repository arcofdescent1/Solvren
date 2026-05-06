/**
 * Phase 1 — fair ingestion (one provider per org per run, oldest last_synced first)
 * then detection pass per connected source.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { ingestStripeForOrg } from "./stripe/ingestStripeForOrg";
import { detectStripeForOrg } from "./stripe/detectStripeForOrg";
import { ingestHubSpotForOrg } from "./hubspot/ingestHubSpotForOrg";
import { detectHubSpotForOrg } from "./hubspot/detectHubSpotForOrg";
import { ingestSalesforceForOrg } from "./salesforce/ingestSalesforceForOrg";
import { detectSalesforceForOrg } from "./salesforce/detectSalesforceForOrg";
import { logJobRun } from "./jobRuns";
import { retryWithBackoff, RETRY_PRESETS } from "@/lib/retry/retryWithBackoff";

type Provider = "stripe" | "hubspot" | "salesforce";

export type ValueEngineBackfillResult = {
  ok: boolean;
  errors: string[];
};

async function getConnectedProviders(admin: SupabaseClient, orgId: string): Promise<Provider[]> {
  const { data } = await admin
    .from("integration_connections")
    .select("provider, status, last_synced_at")
    .eq("org_id", orgId)
    .eq("status", "connected")
    .in("provider", ["stripe", "hubspot", "salesforce"]);

  const list = (data ?? []) as { provider: string; last_synced_at: string | null }[];
  const set = new Set<Provider>();
  for (const r of list) {
    if (r.provider === "stripe" || r.provider === "hubspot" || r.provider === "salesforce") {
      set.add(r.provider);
    }
  }
  return Array.from(set);
}

function pickFairProvider(
  providers: Provider[],
  rows: { provider: string; last_synced_at: string | null }[]
): Provider | null {
  if (providers.length === 0) return null;
  let best: Provider | null = null;
  let bestT = Number.POSITIVE_INFINITY;
  for (const p of providers) {
    const row = rows.find((r) => r.provider === p);
    const t = row?.last_synced_at ? new Date(row.last_synced_at).getTime() : 0;
    if (t < bestT) {
      bestT = t;
      best = p;
    }
  }
  return best;
}

export async function runValueEngineIngestionPass(admin: SupabaseClient): Promise<void> {
  const { data: orgs } = await admin.from("organizations").select("id").limit(5000);
  const orgIds = ((orgs ?? []) as { id: string }[]).map((o) => o.id);

  for (const orgId of orgIds) {
    const { data: conns } = await admin
      .from("integration_connections")
      .select("provider, status, last_synced_at")
      .eq("org_id", orgId)
      .eq("status", "connected")
      .in("provider", ["stripe", "hubspot", "salesforce"]);

    const rows = (conns ?? []) as { provider: string; last_synced_at: string | null }[];
    const providers = await getConnectedProviders(admin, orgId);
    const next = pickFairProvider(providers, rows);
    if (!next) continue;

    try {
      await retryWithBackoff(
        async () => {
          if (next === "stripe") {
            const r = await ingestStripeForOrg(admin, orgId, { mode: "incremental" });
            if (!r.ok) throw new Error(r.error);
          } else if (next === "hubspot") {
            const r = await ingestHubSpotForOrg(admin, orgId);
            if (!r.ok) throw new Error(r.error);
          } else {
            const r = await ingestSalesforceForOrg(admin, orgId);
            if (!r.ok && r.error !== "salesforce_oauth_not_configured" && r.error !== "salesforce_not_connected") {
              throw new Error(r.error);
            }
          }
        },
        RETRY_PRESETS.integrationSync
      );
      await logJobRun(admin, {
        orgId,
        jobType: "ingestion",
        integrationProvider: next,
        success: true,
      });
    } catch (e) {
      await logJobRun(admin, {
        orgId,
        jobType: "ingestion",
        integrationProvider: next,
        success: false,
        errorMessage: e instanceof Error ? e.message : String(e),
      });
    }
  }
}

export async function runValueEngineDetectionPass(admin: SupabaseClient): Promise<void> {
  const { data: orgs } = await admin.from("organizations").select("id").limit(5000);
  const orgIds = ((orgs ?? []) as { id: string }[]).map((o) => o.id);

  for (const orgId of orgIds) {
    const providers = await getConnectedProviders(admin, orgId);
    try {
      await retryWithBackoff(
        async () => {
          if (providers.includes("stripe")) {
            const r = await detectStripeForOrg(admin, orgId);
            if (!r.ok) throw new Error(r.error);
          }
          if (providers.includes("hubspot")) {
            const r = await detectHubSpotForOrg(admin, orgId);
            if (!r.ok) throw new Error(r.error);
          }
          if (providers.includes("salesforce")) {
            const r = await detectSalesforceForOrg(admin, orgId);
            if (!r.ok) throw new Error(r.error);
          }
        },
        RETRY_PRESETS.detectionRunner
      );
      await logJobRun(admin, { orgId, jobType: "detection", success: true });
    } catch (e) {
      await logJobRun(admin, {
        orgId,
        jobType: "detection",
        success: false,
        errorMessage: e instanceof Error ? e.message : String(e),
      });
    }
  }
}

/** Runs ingest backfill + detection; returns aggregate errors (does not throw). */
export async function runValueEngineBackfillOrg(
  admin: SupabaseClient,
  orgId: string
): Promise<ValueEngineBackfillResult> {
  const errors: string[] = [];
  const providers = await getConnectedProviders(admin, orgId);

  if (providers.includes("stripe")) {
    const r = await ingestStripeForOrg(admin, orgId, { mode: "backfill" });
    if (!r.ok) errors.push(`stripe_ingest: ${r.error}`);
  }
  if (providers.includes("hubspot")) {
    const r = await ingestHubSpotForOrg(admin, orgId);
    if (!r.ok) errors.push(`hubspot_ingest: ${r.error}`);
  }
  if (providers.includes("salesforce")) {
    const r = await ingestSalesforceForOrg(admin, orgId);
    if (!r.ok) errors.push(`salesforce_ingest: ${r.error}`);
  }

  const det = await runValueEngineDetectionForOrgWithErrors(admin, orgId);
  errors.push(...det);

  return { ok: errors.length === 0, errors };
}

export async function runValueEngineDetectionForOrgWithErrors(
  admin: SupabaseClient,
  orgId: string
): Promise<string[]> {
  const errors: string[] = [];
  const providers = await getConnectedProviders(admin, orgId);
  if (providers.includes("stripe")) {
    const r = await detectStripeForOrg(admin, orgId);
    if (!r.ok) errors.push(`stripe_detect: ${r.error}`);
  }
  if (providers.includes("hubspot")) {
    const r = await detectHubSpotForOrg(admin, orgId);
    if (!r.ok) errors.push(`hubspot_detect: ${r.error}`);
  }
  if (providers.includes("salesforce")) {
    const r = await detectSalesforceForOrg(admin, orgId);
    if (!r.ok) errors.push(`salesforce_detect: ${r.error}`);
  }
  return errors;
}

/** @deprecated Prefer {@link runValueEngineDetectionForOrgWithErrors} for explicit failure handling. */
export async function runValueEngineDetectionForOrg(admin: SupabaseClient, orgId: string): Promise<void> {
  await runValueEngineDetectionForOrgWithErrors(admin, orgId);
}
