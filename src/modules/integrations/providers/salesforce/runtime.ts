/**
 * Phase 2 — Salesforce connector runtime.
 * Wraps existing Salesforce services.
 */
import type { ConnectorRuntime } from "../../contracts/runtime";
import type { IntegrationProvider } from "../../contracts/types";
import { createAdminClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";
import { getAccountById } from "../../core/integrationAccountsRepo";
import { getSalesforceClientForOrg } from "./salesforceClientForOrg";
import { fetchSalesforceSchema } from "./schema";
import { buildHubSpotHealth } from "../hubspot/health";
import { mapPayloadToCanonicalForIngestion } from "@/lib/integrations/mapping/ingestionBridge";
import { persistWebhookToRawEvents } from "@/modules/signals/ingestion/webhook-to-raw-event.bridge";

async function resolveOrgId(integrationAccountId: string): Promise<string | null> {
  const admin = createAdminClient();
  const { data } = await getAccountById(admin, integrationAccountId);
  if (data) return (data as { org_id?: string }).org_id ?? null;
  const { data: acc } = await admin
    .from("integration_accounts")
    .select("org_id")
    .eq("id", integrationAccountId)
    .maybeSingle();
  return (acc as { org_id?: string } | null)?.org_id ?? null;
}

export function getSalesforceRuntime(): ConnectorRuntime {
  return {
    async connect() {
      return {
        authUrl: "",
        stateToken: "",
        expiresAt: new Date().toISOString(),
      };
    },

    async handleCallback() {
      return {
        success: false,
        errorCode: "use_salesforce_config",
        errorMessage: "Use Salesforce config/setup for connection (OAuth-first coming in Phase 2)",
      };
    },

    async disconnect(input) {
      const admin = createAdminClient();
      const orgId = await resolveOrgId(input.integrationAccountId);
      if (!orgId) return;
      await admin.from("salesforce_orgs").delete().eq("org_id", orgId);
      await admin
        .from("integration_credentials")
        .delete()
        .eq("org_id", orgId)
        .eq("provider", "salesforce");
      await admin
        .from("integration_connections")
        .update({ status: "disconnected" })
        .eq("org_id", orgId)
        .eq("provider", "salesforce");
    },

    async refreshAuth() {
      return { success: false, errorCode: "not_implemented" };
    },

    async testConnection(input) {
      if (!env.salesforceIntegrationEnabled) {
        return { success: false, message: "Salesforce not configured" };
      }
      const orgId = await resolveOrgId(input.integrationAccountId);
      if (!orgId) return { success: false, message: "Account not found" };
      const client = await getSalesforceClientForOrg(orgId);
      if (!client) return { success: false, message: "Salesforce not connected" };
      try {
        await client.executeSoql("SELECT Id FROM Account LIMIT 1");
        return { success: true, message: "Connected" };
      } catch (e) {
        return {
          success: false,
          message: e instanceof Error ? e.message : "Connection failed",
        };
      }
    },

    async getHealth(input) {
      const orgId = await resolveOrgId(input.integrationAccountId);
      if (!orgId) {
        return {
          status: "unhealthy",
          dimensions: {},
          lastCheckedAt: new Date().toISOString(),
        };
      }
      const client = await getSalesforceClientForOrg(orgId);
      if (!client) {
        return {
          status: "unhealthy",
          dimensions: { auth: "unhealthy", api_reachability: "unhealthy" },
          lastCheckedAt: new Date().toISOString(),
        };
      }
      let authOk = false;
      let apiOk = false;
      try {
        await client.executeSoql("SELECT Id FROM Account LIMIT 1");
        authOk = true;
        apiOk = true;
      } catch {
        authOk = false;
        apiOk = false;
      }
      const admin = createAdminClient();
      const { data: conn } = await admin
        .from("integration_connections")
        .select("last_success_at")
        .eq("org_id", orgId)
        .eq("provider", "salesforce")
        .maybeSingle();
      const lastSuccess = (conn as { last_success_at?: string } | null)?.last_success_at ?? null;
      return buildHubSpotHealth(authOk, apiOk, lastSuccess);
    },

    async fetchSchema(input) {
      const orgId = await resolveOrgId(input.integrationAccountId);
      if (!orgId) return { objectTypes: [], error: "Account not found" };
      const client = await getSalesforceClientForOrg(orgId);
      if (!client) return { objectTypes: [], error: "Salesforce not connected" };
      return fetchSalesforceSchema(client);
    },

    async runBackfill(input) {
      const orgId = await resolveOrgId(input.integrationAccountId);
      if (!orgId) return { jobId: "", status: "queued", error: "Account not found" };
      const client = await getSalesforceClientForOrg(orgId);
      if (!client) return { jobId: "", status: "queued", error: "Salesforce not connected" };
      const objectTypes = input.objectTypes ?? ["Lead", "Contact", "Account", "Opportunity"];
      const admin = createAdminClient();
      const soqlByObject: Record<string, string> = {
        Lead: "SELECT Id, Email, FirstName, LastName FROM Lead LIMIT 100",
        Contact: "SELECT Id, Email, FirstName, LastName FROM Contact LIMIT 100",
        Account: "SELECT Id, Name FROM Account LIMIT 100",
        Opportunity: "SELECT Id, Name, StageName, Amount, CloseDate FROM Opportunity LIMIT 100",
      };
      for (const objType of objectTypes) {
        const soql = soqlByObject[objType] ?? `SELECT Id FROM ${objType} LIMIT 100`;
        try {
          const { records } = await client.executeSoql<Record<string, unknown>>(soql);
          for (const rec of records) {
            const mapped = await mapPayloadToCanonicalForIngestion(admin, {
              orgId,
              providerKey: "salesforce",
              sourceObjectType: objType,
              payload: rec,
            });
            if (mapped.mapped) {
              await persistWebhookToRawEvents(admin, {
                orgId,
                integrationAccountId: input.integrationAccountId,
                provider: "salesforce" as IntegrationProvider,
                sourceChannel: "backfill",
                externalObjectType: objType,
                externalObjectId: rec.Id as string,
                eventType: `${objType}.backfill`,
                payload: rec,
                canonicalOutput: mapped.canonical,
              });
            }
          }
        } catch (e) {
          return {
            jobId: "",
            status: "queued",
            error: e instanceof Error ? e.message : "Backfill failed",
          };
        }
      }
      return { jobId: `backfill-${Date.now()}`, status: "running" };
    },

    async runIncrementalSync() {
      return { jobId: "", status: "queued", error: "Incremental sync uses SystemModstamp; implement cursor storage" };
    },

    async receiveWebhook() {
      return { received: false, processedStatus: "received", error: "Salesforce CDC webhooks not implemented" };
    },

    async reconcileWebhooks() {
      return { success: false, error: "Not implemented" };
    },

    async executeAction() {
      return {
        success: false,
        errorCode: "not_implemented",
        errorMessage: "Salesforce actions not yet implemented",
      };
    },
  };
}
