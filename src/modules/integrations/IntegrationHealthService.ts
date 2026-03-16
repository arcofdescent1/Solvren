/**
 * IntegrationHealthService — single source of truth for provider health.
 * All health updates must go through this service. Uses integration_connections
 * health columns (last_error, last_success_at, health_status).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { IntegrationProvider, HealthStatus } from "./types";

export class IntegrationHealthService {
  constructor(private admin: SupabaseClient) {}

  async markHealthy(
    orgId: string,
    provider: IntegrationProvider
  ): Promise<void> {
    await this.admin
      .from("integration_connections")
      .update({
        health_status: "healthy",
        last_success_at: new Date().toISOString(),
        last_error: null,
        updated_at: new Date().toISOString(),
      })
      .eq("org_id", orgId)
      .eq("provider", provider);
  }

  async markDegraded(
    orgId: string,
    provider: IntegrationProvider,
    error?: string
  ): Promise<void> {
    await this.admin
      .from("integration_connections")
      .update({
        health_status: "degraded",
        last_error: error ?? undefined,
        updated_at: new Date().toISOString(),
      })
      .eq("org_id", orgId)
      .eq("provider", provider);
  }

  async markError(
    orgId: string,
    provider: IntegrationProvider,
    error?: string
  ): Promise<void> {
    await this.admin
      .from("integration_connections")
      .update({
        health_status: "error",
        last_error: error ?? undefined,
        updated_at: new Date().toISOString(),
      })
      .eq("org_id", orgId)
      .eq("provider", provider);
  }

  async recordSuccess(orgId: string, provider: IntegrationProvider): Promise<void> {
    await this.admin
      .from("integration_connections")
      .update({
        last_success_at: new Date().toISOString(),
        last_error: null,
        updated_at: new Date().toISOString(),
      })
      .eq("org_id", orgId)
      .eq("provider", provider);
  }

  async recordFailure(
    orgId: string,
    provider: IntegrationProvider,
    error: string
  ): Promise<void> {
    await this.admin
      .from("integration_connections")
      .update({
        last_error: error,
        health_status: "error",
        updated_at: new Date().toISOString(),
      })
      .eq("org_id", orgId)
      .eq("provider", provider);
  }

  async getHealth(
    orgId: string,
    provider: IntegrationProvider
  ): Promise<{
    healthStatus: HealthStatus | null;
    lastSuccessAt: string | null;
    lastError: string | null;
  } | null> {
    const { data } = await this.admin
      .from("integration_connections")
      .select("health_status, last_success_at, last_error")
      .eq("org_id", orgId)
      .eq("provider", provider)
      .maybeSingle();

    if (!data) return null;

    const row = data as {
      health_status?: string | null;
      last_success_at?: string | null;
      last_error?: string | null;
    };

    return {
      healthStatus: (row.health_status as HealthStatus) ?? null,
      lastSuccessAt: row.last_success_at ?? null,
      lastError: row.last_error ?? null,
    };
  }
}
