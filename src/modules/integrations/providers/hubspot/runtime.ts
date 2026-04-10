/**
 * Phase 2 — HubSpot connector runtime.
 * Wraps existing HubSpot services; routes through mapping engine.
 */
import type { ConnectorRuntime } from "../../contracts/runtime";
import type { IntegrationProvider } from "../../contracts/types";
import { createAdminClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";
import { signHubSpotState } from "@/lib/hubspot/state";
import { getAccountById } from "../../core/integrationAccountsRepo";
import { getHubSpotClientForOrg } from "./hubspotClientForOrg";
import { fetchHubSpotSchema } from "./schema";
import { buildHubSpotHealth } from "./health";
import { mapPayloadToCanonicalForIngestion } from "@/lib/integrations/mapping/ingestionBridge";
import { persistWebhookToRawEvents } from "@/modules/signals/ingestion/webhook-to-raw-event.bridge";

const SCOPES =
  "crm.objects.contacts.read crm.objects.companies.read crm.objects.deals.read crm.schemas.contacts.read crm.schemas.companies.read crm.schemas.deals.read";

/** Resolve orgId from integration_account_id. */
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

export function getHubSpotRuntime(): ConnectorRuntime {
  return {
    async connect(input) {
      if (!env.hubspotIntegrationEnabled) {
        return { authUrl: "", stateToken: input.stateToken, expiresAt: new Date().toISOString() };
      }
      const clientId = env.hubspotClientId;
      if (!clientId) {
        return { authUrl: "", stateToken: input.stateToken, expiresAt: new Date().toISOString() };
      }
      const redirectUri = input.redirectUri ?? env.hubspotRedirectUri ?? `${env.appUrl}/api/integrations/hubspot/oauth/callback`;
      const state = signHubSpotState({ orgId: input.orgId, userId: input.userId });
      const url = new URL(env.hubspotOAuthAuthorizeUrl);
      url.searchParams.set("client_id", clientId);
      url.searchParams.set("redirect_uri", redirectUri);
      url.searchParams.set("scope", SCOPES);
      url.searchParams.set("state", state);
      return {
        authUrl: url.toString(),
        stateToken: input.stateToken,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      };
    },

    async handleCallback(input) {
      if (input.error) {
        return {
          success: false,
          errorCode: input.error,
          errorMessage: input.errorDescription ?? input.error,
        };
      }
      // Delegation: HubSpot uses bespoke oauth/callback which handles persistence.
      // Generic callback would need code exchange here. For now return not_implemented
      // so the bespoke route remains the primary path.
      return {
        success: false,
        errorCode: "use_hubspot_oauth",
        errorMessage: "Use /api/integrations/hubspot/oauth/start for HubSpot connection",
      };
    },

    async disconnect(input) {
      const admin = createAdminClient();
      const orgId = await resolveOrgId(input.integrationAccountId);
      if (!orgId) return;
      await admin
        .from("integration_credentials")
        .delete()
        .eq("org_id", orgId)
        .eq("provider", "hubspot");
      await admin
        .from("integration_connections")
        .update({ status: "disconnected" })
        .eq("org_id", orgId)
        .eq("provider", "hubspot");
    },

    async refreshAuth() {
      return { success: false, errorCode: "not_implemented" };
    },

    async testConnection(input) {
      if (!env.hubspotIntegrationEnabled) {
        return { success: false, message: "HubSpot not configured" };
      }
      const orgId = await resolveOrgId(input.integrationAccountId);
      if (!orgId) return { success: false, message: "Account not found" };
      const result = await getHubSpotClientForOrg(orgId);
      if (!result) return { success: false, message: "HubSpot not connected" };
      try {
        await result.client.testConnection();
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
      const result = await getHubSpotClientForOrg(orgId);
      if (!result) {
        return {
          status: "unhealthy",
          dimensions: { auth: "unhealthy", api_reachability: "unhealthy" },
          lastCheckedAt: new Date().toISOString(),
        };
      }
      let authOk = false;
      let apiOk = false;
      try {
        await result.client.testConnection();
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
        .eq("provider", "hubspot")
        .maybeSingle();
      const lastSuccess = (conn as { last_success_at?: string } | null)?.last_success_at ?? null;
      return buildHubSpotHealth(authOk, apiOk, lastSuccess);
    },

    async fetchSchema(input) {
      const orgId = await resolveOrgId(input.integrationAccountId);
      if (!orgId) return { objectTypes: [], error: "Account not found" };
      const result = await getHubSpotClientForOrg(orgId);
      if (!result) return { objectTypes: [], error: "HubSpot not connected" };
      return fetchHubSpotSchema(result.client);
    },

    async runBackfill(input) {
      const orgId = await resolveOrgId(input.integrationAccountId);
      if (!orgId) return { jobId: "", status: "queued", error: "Account not found" };
      const result = await getHubSpotClientForOrg(orgId);
      if (!result) return { jobId: "", status: "queued", error: "HubSpot not connected" };
      const objectTypes = input.objectTypes ?? ["contacts", "companies", "deals"];
      const admin = createAdminClient();
      for (const objType of objectTypes) {
        try {
          const { results } = await result.client.searchCrmObjects(objType, { limit: 100 });
          for (const item of results) {
            const mapped = await mapPayloadToCanonicalForIngestion(admin, {
              orgId,
              providerKey: "hubspot",
              sourceObjectType: objType,
              payload: item,
            });
            if (mapped.mapped) {
              await persistWebhookToRawEvents(admin, {
                orgId,
                integrationAccountId: input.integrationAccountId,
                provider: "hubspot" as IntegrationProvider,
                sourceChannel: "backfill",
                externalObjectType: objType,
                externalObjectId: (item as Record<string, unknown>)?.id as string,
                eventType: `${objType}.backfill`,
                payload: item as Record<string, unknown>,
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

    async runIncrementalSync(input) {
      const orgId = await resolveOrgId(input.integrationAccountId);
      if (!orgId) return { jobId: "", status: "queued", error: "Account not found" };
      const result = await getHubSpotClientForOrg(orgId);
      if (!result) return { jobId: "", status: "queued", error: "HubSpot not connected" };
      const lastSync = (input.cursor as { lastSync?: string })?.lastSync;
      const sorts = lastSync
        ? [{ propertyName: "hs_lastmodifieddate", direction: "ASCENDING" }]
        : [{ propertyName: "createdate", direction: "DESCENDING" }];
      try {
        const { results } = await result.client.searchCrmObjects("contacts", {
          limit: 50,
          sorts,
        });
        const admin = createAdminClient();
        for (const item of results) {
          const mapped = await mapPayloadToCanonicalForIngestion(admin, {
            orgId,
            providerKey: "hubspot",
            sourceObjectType: "contacts",
            payload: item,
          });
          if (mapped.mapped) {
            await persistWebhookToRawEvents(admin, {
              orgId,
              integrationAccountId: input.integrationAccountId,
              provider: "hubspot" as IntegrationProvider,
              sourceChannel: "incremental_sync",
              externalObjectType: "contacts",
              externalObjectId: (item as Record<string, unknown>)?.id as string,
              eventType: "contact.updated",
              payload: item as Record<string, unknown>,
              canonicalOutput: mapped.canonical,
            });
          }
        }
        return {
          jobId: `incr-${Date.now()}`,
          status: "running",
          nextCursor: { lastSync: new Date().toISOString() },
        };
      } catch (e) {
        return {
          jobId: "",
          status: "queued",
          error: e instanceof Error ? e.message : "Incremental sync failed",
        };
      }
    },

    async receiveWebhook(input) {
      const admin = createAdminClient();
      const payload = input.payload as Record<string, unknown>;
      const portalId = (payload.portalId ?? payload.portal_id ?? (payload.subscriptionDetails as Array<{ portalId?: number }>)?.[0]?.portalId) as number | undefined;
      if (portalId == null) {
        return { received: true, processedStatus: "received" };
      }
      const { data: hubAccount } = await admin
        .from("hubspot_accounts")
        .select("org_id")
        .eq("hub_id", portalId)
        .maybeSingle();
      const orgId = (hubAccount as { org_id?: string } | null)?.org_id;
      if (!orgId) {
        return { received: true, processedStatus: "received" };
      }
      const subscriptionType = (payload.subscriptionType ?? payload.subscription_type ?? "unknown") as string;
      const objectId = (payload.objectId ?? payload.object_id) as string | undefined;
      const obj = payload.object ?? payload;
      const sourceObjectType =
        subscriptionType.startsWith("contact") ? "contacts"
        : subscriptionType.startsWith("company") ? "companies"
        : subscriptionType.startsWith("deal") ? "deals"
        : subscriptionType;
      const mapped = sourceObjectType
        ? await mapPayloadToCanonicalForIngestion(admin, {
            orgId,
            providerKey: "hubspot",
            sourceObjectType,
            payload: obj ?? payload,
          })
        : null;
      await persistWebhookToRawEvents(admin, {
        orgId,
        integrationAccountId: input.integrationAccountId ?? null,
        provider: "hubspot" as IntegrationProvider,
        sourceChannel: "webhook",
        externalEventId: (payload.eventId ?? payload.requestId) as string | undefined,
        externalObjectType: subscriptionType,
        externalObjectId: objectId ?? undefined,
        eventType: subscriptionType,
        eventTime: payload.occurredAt ? new Date((payload.occurredAt as number) * 1000).toISOString() : undefined,
        payload,
        headers: input.headers,
        canonicalOutput: mapped?.mapped ? mapped.canonical : undefined,
      });
      return { received: true, processedStatus: "received" };
    },

    async reconcileWebhooks() {
      return { success: false, error: "Not implemented" };
    },

    async executeAction(input) {
      if (input.actionKey === "create_task") {
        const { executeHubSpotCreateTask } = await import("./actions/createTask");
        const admin = createAdminClient();
        return executeHubSpotCreateTask(admin, {
          orgId: input.orgId,
          params: input.params,
        });
      }
      return {
        success: false,
        errorCode: "not_implemented",
        errorMessage: `Unknown action: ${input.actionKey}`,
      };
    },
  };
}
