/**
 * IntegrationRetryService — canonical retry handling for integration event failures.
 * Uses integration_event_failures and shared schedule from lib/integrations/retry.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { nextRetryAt, DEFAULT_MAX_ATTEMPTS } from "@/lib/integrations/retry";
import type { IntegrationProvider } from "./types";

export class IntegrationRetryService {
  constructor(private admin: SupabaseClient) {}

  async recordRetryableFailure(
    provider: IntegrationProvider,
    orgId: string,
    eventType: string,
    payload: Record<string, unknown>,
    entityInfo: { entityType?: string; entityId?: string },
    error: { code?: string; message: string }
  ): Promise<string> {
    const { data, error: insertError } = await this.admin
      .from("integration_event_failures")
      .insert({
        org_id: orgId,
        provider,
        event_type: eventType,
        payload,
        entity_type: entityInfo.entityType ?? null,
        entity_id: entityInfo.entityId ?? null,
        error_message: error.message,
        error_code: error.code ?? null,
        attempts: 0,
        attempt_count: 0,
        max_attempts: DEFAULT_MAX_ATTEMPTS,
        next_retry_at: nextRetryAt(0),
        status: "pending",
      })
      .select("id")
      .single();

    if (insertError) throw new Error(`Failed to record failure: ${insertError.message}`);
    return (data as { id: string }).id;
  }

  async recordPermanentFailure(
    provider: IntegrationProvider,
    orgId: string,
    eventType: string,
    payload: Record<string, unknown>,
    entityInfo: { entityType?: string; entityId?: string },
    error: { code?: string; message: string }
  ): Promise<string> {
    const { data, error: insertError } = await this.admin
      .from("integration_event_failures")
      .insert({
        org_id: orgId,
        provider,
        event_type: eventType,
        payload,
        entity_type: entityInfo.entityType ?? null,
        entity_id: entityInfo.entityId ?? null,
        error_message: error.message,
        error_code: error.code ?? null,
        attempts: 999,
        attempt_count: 999,
        max_attempts: DEFAULT_MAX_ATTEMPTS,
        status: "failed_permanent",
        resolved_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (insertError) throw new Error(`Failed to record failure: ${insertError.message}`);
    return (data as { id: string }).id;
  }

  async getPendingCount(orgId: string, provider: IntegrationProvider): Promise<number> {
    const { count } = await this.admin
      .from("integration_event_failures")
      .select("id", { count: "exact", head: true })
      .eq("org_id", orgId)
      .eq("provider", provider)
      .in("status", ["pending", "retrying"]);

    return count ?? 0;
  }

  async retryNow(orgId: string, provider: IntegrationProvider): Promise<number> {
    const now = new Date().toISOString();
    const { data } = await this.admin
      .from("integration_event_failures")
      .update({
        next_retry_at: now,
        status: "pending",
        updated_at: now,
      })
      .eq("org_id", orgId)
      .eq("provider", provider)
      .in("status", ["pending", "retrying"])
      .select("id");

    return (data ?? []).length;
  }

  async resolveFailure(failureId: string): Promise<void> {
    const now = new Date().toISOString();
    await this.admin
      .from("integration_event_failures")
      .update({
        status: "resolved",
        resolved_at: now,
        updated_at: now,
      })
      .eq("id", failureId);
  }
}
