/**
 * Phase 2 — Stripe connector runtime.
 * API key + webhook model.
 */
import type { ConnectorRuntime } from "../../contracts/runtime";
import type { IntegrationProvider } from "../../contracts/types";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAccountById } from "../../core/integrationAccountsRepo";
import { getStripeClientForOrg } from "./stripeClientForOrg";
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

const OBJECT_TYPES = [
  { key: "customer", label: "Customers", syncable: true },
  { key: "payment_intent", label: "Payment Intents", syncable: true },
  { key: "charge", label: "Charges", syncable: true },
  { key: "invoice", label: "Invoices", syncable: true },
  { key: "subscription", label: "Subscriptions", syncable: true },
  { key: "dispute", label: "Disputes", syncable: true },
];

export function getStripeRuntime(): ConnectorRuntime {
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
        errorCode: "api_key_required",
        errorMessage: "Stripe uses API key; configure via connect/setup",
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
        .eq("provider", "stripe");
      await admin
        .from("integration_connections")
        .update({ status: "disconnected" })
        .eq("org_id", orgId)
        .eq("provider", "stripe");
    },

    async refreshAuth() {
      return { success: false, errorCode: "not_applicable" };
    },

    async testConnection(input) {
      const orgId = await resolveOrgId(input.integrationAccountId);
      if (!orgId) return { success: false, message: "Account not found" };
      const stripe = await getStripeClientForOrg(orgId);
      if (!stripe) return { success: false, message: "Stripe not connected" };
      try {
        await stripe.accounts.retrieve();
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
      const stripe = await getStripeClientForOrg(orgId);
      if (!stripe) {
        return {
          status: "unhealthy",
          dimensions: { auth: "unhealthy", api_reachability: "unhealthy" },
          lastCheckedAt: new Date().toISOString(),
        };
      }
      let authOk = false;
      let apiOk = false;
      try {
        await stripe.accounts.retrieve();
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
        .eq("provider", "stripe")
        .maybeSingle();
      const lastSuccess = (conn as { last_success_at?: string } | null)?.last_success_at ?? null;
      return buildHubSpotHealth(authOk, apiOk, lastSuccess);
    },

    async fetchSchema() {
      return {
        objectTypes: OBJECT_TYPES,
        objectFields: {},
      };
    },

    async runBackfill(input) {
      const orgId = await resolveOrgId(input.integrationAccountId);
      if (!orgId) return { jobId: "", status: "queued", error: "Account not found" };
      const stripe = await getStripeClientForOrg(orgId);
      if (!stripe) return { jobId: "", status: "queued", error: "Stripe not connected" };
      const admin = createAdminClient();

      const objectTypes = input.objectTypes ?? ["customer", "charge"];
      for (const objType of objectTypes) {
        try {
          if (objType === "customer") {
            const customers = await stripe.customers.list({ limit: 100 });
            for (const c of customers.data) {
              const mapped = await mapPayloadToCanonicalForIngestion(admin, {
                orgId,
                providerKey: "stripe",
                sourceObjectType: "customer",
                payload: c,
              });
              if (mapped.mapped) {
                await persistWebhookToRawEvents(admin, {
                  orgId,
                  integrationAccountId: input.integrationAccountId,
                  provider: "stripe" as IntegrationProvider,
                  sourceChannel: "backfill",
                  externalObjectType: "customer",
                  externalObjectId: c.id,
                  eventType: "customer.backfill",
                  payload: c as unknown as Record<string, unknown>,
                  canonicalOutput: mapped.canonical,
                });
              }
            }
          } else if (objType === "charge") {
            const charges = await stripe.charges.list({ limit: 100 });
            for (const ch of charges.data) {
              const mapped = await mapPayloadToCanonicalForIngestion(admin, {
                orgId,
                providerKey: "stripe",
                sourceObjectType: "charge",
                payload: ch,
              });
              if (mapped.mapped) {
                await persistWebhookToRawEvents(admin, {
                  orgId,
                  integrationAccountId: input.integrationAccountId,
                  provider: "stripe" as IntegrationProvider,
                  sourceChannel: "backfill",
                  externalObjectType: "charge",
                  externalObjectId: ch.id,
                  eventType: "charge.backfill",
                  payload: ch as unknown as Record<string, unknown>,
                  canonicalOutput: mapped.canonical,
                });
              }
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
      return { jobId: "", status: "queued", error: "Use webhooks for Stripe sync" };
    },

    async receiveWebhook(_input) {
      // Webhook handling is in the dedicated route.
      return { received: true, processedStatus: "received" };
    },

    async reconcileWebhooks() {
      return { success: false, error: "Not implemented" };
    },

    async executeAction(input) {
      if (input.actionKey === "retry_payment") {
        const { executeStripeRetryPayment } = await import("./actions/retryPayment");
        const admin = createAdminClient();
        return executeStripeRetryPayment(admin, {
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
