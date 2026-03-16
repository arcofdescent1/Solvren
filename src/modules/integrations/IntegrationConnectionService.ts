/**
 * IntegrationConnectionService — single source of truth for provider connection lifecycle.
 * All connection create/update/disconnect must go through this service.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { IntegrationProvider, ConnectionStatus } from "./types";

export type IntegrationConnectionRow = {
  id: string;
  org_id: string;
  provider: string;
  status: string;
  config: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  last_error?: string | null;
  last_success_at?: string | null;
  health_status?: string | null;
};

export class IntegrationConnectionService {
  constructor(private admin: SupabaseClient) {}

  async getConnection(
    orgId: string,
    provider: IntegrationProvider
  ): Promise<IntegrationConnectionRow | null> {
    const { data } = await this.admin
      .from("integration_connections")
      .select("*")
      .eq("org_id", orgId)
      .eq("provider", provider)
      .maybeSingle();

    return data as IntegrationConnectionRow | null;
  }

  async createConnection(
    orgId: string,
    provider: IntegrationProvider,
    initialConfig: Record<string, unknown> = {}
  ): Promise<IntegrationConnectionRow> {
    const { data, error } = await this.admin
      .from("integration_connections")
      .insert({
        org_id: orgId,
        provider,
        status: "connecting",
        config: initialConfig,
      })
      .select()
      .single();

    if (error) throw new Error(`Failed to create connection: ${error.message}`);
    return data as IntegrationConnectionRow;
  }

  async updateConnectionStatus(
    orgId: string,
    provider: IntegrationProvider,
    status: ConnectionStatus
  ): Promise<void> {
    const { error } = await this.admin
      .from("integration_connections")
      .update({
        status,
        updated_at: new Date().toISOString(),
      })
      .eq("org_id", orgId)
      .eq("provider", provider);

    if (error) throw new Error(`Failed to update status: ${error.message}`);
  }

  async saveProviderConfig(
    orgId: string,
    provider: IntegrationProvider,
    config: Record<string, unknown>
  ): Promise<void> {
    const { error } = await this.admin
      .from("integration_connections")
      .update({
        config,
        updated_at: new Date().toISOString(),
      })
      .eq("org_id", orgId)
      .eq("provider", provider);

    if (error) throw new Error(`Failed to save config: ${error.message}`);
  }

  async mergeProviderConfig(
    orgId: string,
    provider: IntegrationProvider,
    partial: Record<string, unknown>
  ): Promise<IntegrationConnectionRow | null> {
    const existing = await this.getConnection(orgId, provider);
    if (!existing) return null;

    const merged = { ...(existing.config ?? {}), ...partial };

    await this.saveProviderConfig(orgId, provider, merged);
    return this.getConnection(orgId, provider);
  }

  async markConfigured(orgId: string, provider: IntegrationProvider): Promise<void> {
    await this.updateConnectionStatus(orgId, provider, "configured");
  }

  async disconnectProvider(orgId: string, provider: IntegrationProvider): Promise<void> {
    await this.admin
      .from("integration_credentials")
      .delete()
      .eq("org_id", orgId)
      .eq("provider", provider);

    await this.admin
      .from("integration_connections")
      .update({
        status: "disconnected",
        config: {},
        last_error: null,
        health_status: null,
        updated_at: new Date().toISOString(),
      })
      .eq("org_id", orgId)
      .eq("provider", provider);
  }

  async upsertConnected(
    orgId: string,
    provider: IntegrationProvider,
    config: Record<string, unknown>
  ): Promise<IntegrationConnectionRow> {
    const { data, error } = await this.admin
      .from("integration_connections")
      .upsert(
        {
          org_id: orgId,
          provider,
          status: "connected",
          config,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "org_id,provider" }
      )
      .select()
      .single();

    if (error) throw new Error(`Failed to upsert connection: ${error.message}`);
    return data as IntegrationConnectionRow;
  }
}
