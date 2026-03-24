/**
 * Phase 4 — Shared webhook intake. Validates, resolves context, writes to integration_inbound_events.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { ingestInboundEvent } from "../reliability/services/inbound-ingest.service";
import { getAccountByOrgAndProvider } from "../core/integrationAccountsRepo";
import { upsertProviderIntegrationAccount } from "../core/providerAccountLinkService";
import type { IntegrationProvider } from "../contracts/types";
export type Phase4WebhookIntakeInput = {
  provider: IntegrationProvider;
  orgId: string;
  integrationAccountId?: string | null;
  sourceChannel?: "webhook" | "reconcile" | "salesforce_cdc";
  externalEventId?: string | null;
  externalObjectType?: string | null;
  externalObjectId?: string | null;
  eventType: string;
  eventTime?: string | null;
  payload: Record<string, unknown>;
  headers?: Record<string, unknown> | null;
};

export type Phase4WebhookIntakeResult =
  | { ok: true; eventId: string; duplicate: boolean }
  | { ok: false; error: string; statusCode?: number };

/** Ensure integration_account exists for org+provider; return account id. */
async function resolveIntegrationAccount(
  supabase: SupabaseClient,
  orgId: string,
  provider: string
): Promise<string> {
  const { data: account } = await getAccountByOrgAndProvider(supabase, orgId, provider);
  if (account) return account.id;
  const { id } = await upsertProviderIntegrationAccount(supabase, {
    orgId,
    provider: provider as IntegrationProvider,
    status: "connected",
  });
  return id;
}

export async function phase4WebhookIntake(
  supabase: SupabaseClient,
  input: Phase4WebhookIntakeInput
): Promise<Phase4WebhookIntakeResult> {
  const integrationAccountId =
    input.integrationAccountId ??
    (await resolveIntegrationAccount(supabase, input.orgId, input.provider));

  const result = await ingestInboundEvent(supabase, {
    orgId: input.orgId,
    integrationAccountId,
    provider: input.provider,
    sourceChannel: input.sourceChannel ?? "webhook",
    externalEventId: input.externalEventId,
    externalObjectType: input.externalObjectType,
    externalObjectId: input.externalObjectId,
    eventType: input.eventType,
    eventTime: input.eventTime,
    payload: input.payload,
    headers: input.headers ?? null,
    initialStatus: "VALIDATED",
  });

  if (result.persisted) {
    return { ok: true, eventId: result.eventId, duplicate: result.duplicate };
  }
  return { ok: false, error: result.error, statusCode: 500 };
}
