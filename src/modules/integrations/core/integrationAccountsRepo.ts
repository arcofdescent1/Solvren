/**
 * Phase 1 — integration_accounts persistence (§20.3).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { IntegrationAccountStatus } from "../contracts/types";

export type IntegrationAccountRow = {
  id: string;
  org_id: string;
  provider: string;
  display_name: string;
  category: string;
  auth_type: string;
  status: IntegrationAccountStatus;
  connection_mode: string;
  installed_by_user_id: string | null;
  installed_at: string | null;
  disconnected_at: string | null;
  last_success_at: string | null;
  last_error_at: string | null;
  last_error_code: string | null;
  last_error_message: string | null;
  health_summary_json: Record<string, unknown>;
  scopes_granted_json: string[];
  scopes_missing_json: string[];
  config_json: Record<string, unknown>;
  secrets_ref: string | null;
  metadata_json: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export async function getAccountByOrgAndProvider(
  supabase: SupabaseClient,
  orgId: string,
  provider: string
): Promise<{ data: IntegrationAccountRow | null; error: Error | null }> {
  const { data, error } = await supabase
    .from("integration_accounts")
    .select("*")
    .eq("org_id", orgId)
    .eq("provider", provider)
    .maybeSingle();
  return { data: data as IntegrationAccountRow | null, error: error as Error | null };
}

export async function getAccountsByOrg(
  supabase: SupabaseClient,
  orgId: string
): Promise<{ data: IntegrationAccountRow[]; error: Error | null }> {
  const { data, error } = await supabase
    .from("integration_accounts")
    .select("*")
    .eq("org_id", orgId)
    .order("provider", { ascending: true });
  return { data: (data ?? []) as IntegrationAccountRow[], error: error as Error | null };
}

export async function insertIntegrationAccount(
  supabase: SupabaseClient,
  row: Omit<IntegrationAccountRow, "id" | "created_at" | "updated_at">
): Promise<{ data: IntegrationAccountRow | null; error: Error | null }> {
  const { data, error } = await supabase
    .from("integration_accounts")
    .insert({
      ...row,
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();
  return { data: data as IntegrationAccountRow | null, error: error as Error | null };
}

export async function updateIntegrationAccount(
  supabase: SupabaseClient,
  id: string,
  updates: Partial<Pick<IntegrationAccountRow, "status" | "last_success_at" | "last_error_at" | "last_error_code" | "last_error_message" | "health_summary_json" | "scopes_granted_json" | "scopes_missing_json" | "config_json" | "disconnected_at" | "installed_at" | "installed_by_user_id">>
): Promise<{ error: Error | null }> {
  const { error } = await supabase
    .from("integration_accounts")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id);
  return { error: error as Error | null };
}

export async function getAccountById(
  supabase: SupabaseClient,
  id: string
): Promise<{ data: IntegrationAccountRow | null; error: Error | null }> {
  const { data, error } = await supabase
    .from("integration_accounts")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  return { data: data as IntegrationAccountRow | null, error: error as Error | null };
}
