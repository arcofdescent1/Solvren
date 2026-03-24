import type { SupabaseClient } from "@supabase/supabase-js";
import type { IntegrationProvider } from "../contracts/types";
import { getProviderManifest } from "../registry/getProviderManifest";
import { getAccountByOrgAndProvider, insertIntegrationAccount, updateIntegrationAccount } from "./integrationAccountsRepo";

type LinkAccountInput = {
  orgId: string;
  provider: IntegrationProvider;
  installedByUserId?: string | null;
  status?: "connected" | "disconnected" | "error" | "connected_limited";
  metadata?: Record<string, unknown>;
  config?: Record<string, unknown>;
};

export async function upsertProviderIntegrationAccount(
  supabase: SupabaseClient,
  input: LinkAccountInput
): Promise<{ id: string; created: boolean }> {
  const manifest = getProviderManifest(input.provider);
  const displayName = manifest?.displayName ?? input.provider;
  const category = manifest?.category ?? "crm";
  const authType = manifest?.authType ?? "oauth2";
  const now = new Date().toISOString();
  const status = input.status ?? "connected";

  const { data: existing } = await getAccountByOrgAndProvider(supabase, input.orgId, input.provider);
  if (existing) {
    const mergedMetadata = {
      ...(existing.metadata_json ?? {}),
      ...(input.metadata ?? {}),
    };
    const mergedConfig = {
      ...(existing.config_json ?? {}),
      ...(input.config ?? {}),
    };

    await updateIntegrationAccount(supabase, existing.id, {
      status,
      installed_at: existing.installed_at ?? now,
      installed_by_user_id: existing.installed_by_user_id ?? input.installedByUserId ?? null,
      disconnected_at: status === "disconnected" ? now : null,
      last_success_at: status === "connected" || status === "connected_limited" ? now : existing.last_success_at,
      last_error_at: status === "error" ? now : existing.last_error_at,
      last_error_code: status === "error" ? (existing.last_error_code ?? "provider_error") : null,
      last_error_message: status === "error" ? (existing.last_error_message ?? "Provider health check failed") : null,
      config_json: mergedConfig,
    });
    await supabase
      .from("integration_accounts")
      .update({ metadata_json: mergedMetadata, updated_at: now })
      .eq("id", existing.id);
    return { id: existing.id, created: false };
  }

  const { data: created, error } = await insertIntegrationAccount(supabase, {
    org_id: input.orgId,
    provider: input.provider,
    display_name: displayName,
    category,
    auth_type: authType,
    status,
    connection_mode: "oauth",
    installed_by_user_id: input.installedByUserId ?? null,
    installed_at: now,
    disconnected_at: status === "disconnected" ? now : null,
    last_success_at: status === "connected" || status === "connected_limited" ? now : null,
    last_error_at: status === "error" ? now : null,
    last_error_code: status === "error" ? "provider_error" : null,
    last_error_message: status === "error" ? "Provider health check failed" : null,
    health_summary_json: {},
    scopes_granted_json: [],
    scopes_missing_json: [],
    config_json: input.config ?? {},
    secrets_ref: null,
    metadata_json: input.metadata ?? {},
  });
  if (error || !created) {
    throw new Error(error?.message ?? "Failed to create integration account");
  }
  return { id: created.id, created: true };
}
