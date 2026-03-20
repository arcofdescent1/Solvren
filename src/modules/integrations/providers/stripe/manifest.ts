/**
 * Phase 1 — Stripe connector manifest (§14.3).
 * Tier 1: Payments, API key or OAuth, webhooks, read-focused.
 */
import type { ConnectorManifest } from "../../contracts";

export function getStripeManifest(): ConnectorManifest {
  return {
    provider: "stripe",
    displayName: "Stripe",
    category: "payments",
    description: "Identify failed payment patterns and at-risk subscription revenue.",
    authType: "api_key",
    supportedSyncModes: ["polling", "webhook", "hybrid"],
    capabilities: [
      "read_objects",
      "receive_events",
      "health_checks",
      "backfill",
      "incremental_sync",
    ],
    supportedObjectTypes: ["customers", "subscriptions", "invoices", "payment_intents", "charges", "disputes"],
    supportedInboundEvents: ["customer.subscription.updated", "invoice.payment_failed", "charge.failed"],
    supportedOutboundActions: ["retry_payment", "update_payment_method", "apply_discount"],
    requiredScopes: [],
    optionalScopes: [],
    installPrerequisites: ["Stripe account", "API key (secret key)"],
    docsUrl: "https://stripe.com/docs/api",
    iconAssetKey: "stripe",
    healthCheckStrategy: "api_probe",
    minimumPlan: "growth",
    isTierOne: true,
  };
}
