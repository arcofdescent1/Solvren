/**
 * Phase 1 — integration_credentials persistence (§8.4, §20.3).
 * Store only refs; actual secrets in secret manager.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export type IntegrationCredentialRow = {
  id: string;
  integration_account_id: string;
  credential_type: string;
  secret_ref: string;
  expires_at: string | null;
  refreshable: boolean;
  last_refreshed_at: string | null;
  created_at: string;
  updated_at: string;
};

export async function getCredentialsByAccountId(
  supabase: SupabaseClient,
  integrationAccountId: string
): Promise<{ data: IntegrationCredentialRow[]; error: Error | null }> {
  const { data, error } = await supabase
    .from("integration_credentials")
    .select("*")
    .eq("integration_account_id", integrationAccountId);
  return { data: (data ?? []) as IntegrationCredentialRow[], error: error as Error | null };
}

export async function insertCredential(
  supabase: SupabaseClient,
  row: Omit<IntegrationCredentialRow, "id" | "created_at" | "updated_at">
): Promise<{ data: IntegrationCredentialRow | null; error: Error | null }> {
  const { data, error } = await supabase
    .from("integration_credentials")
    .insert({
      ...row,
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();
  return { data: data as IntegrationCredentialRow | null, error: error as Error | null };
}

export async function updateCredential(
  supabase: SupabaseClient,
  id: string,
  updates: Partial<Pick<IntegrationCredentialRow, "secret_ref" | "expires_at" | "last_refreshed_at">>
): Promise<{ error: Error | null }> {
  const { error } = await supabase
    .from("integration_credentials")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id);
  return { error: error as Error | null };
}
