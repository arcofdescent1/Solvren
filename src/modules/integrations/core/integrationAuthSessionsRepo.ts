/**
 * Phase 1 — integration_auth_sessions persistence (§8.3).
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export type IntegrationAuthSessionRow = {
  id: string;
  org_id: string;
  provider: string;
  initiated_by_user_id: string;
  state_token: string;
  pkce_verifier: string | null;
  redirect_uri: string;
  requested_scopes_json: string[];
  status: "pending" | "completed" | "failed" | "expired";
  expires_at: string;
  callback_received_at: string | null;
  error_json: unknown;
  created_at: string;
};

export async function insertAuthSession(
  supabase: SupabaseClient,
  row: Omit<IntegrationAuthSessionRow, "id" | "created_at">
): Promise<{ data: IntegrationAuthSessionRow | null; error: Error | null }> {
  const { data, error } = await supabase
    .from("integration_auth_sessions")
    .insert(row)
    .select()
    .single();
  return { data: data as IntegrationAuthSessionRow | null, error: error as Error | null };
}

export async function getAuthSessionByStateToken(
  supabase: SupabaseClient,
  stateToken: string
): Promise<{ data: IntegrationAuthSessionRow | null; error: Error | null }> {
  const { data, error } = await supabase
    .from("integration_auth_sessions")
    .select("*")
    .eq("state_token", stateToken)
    .maybeSingle();
  return { data: data as IntegrationAuthSessionRow | null, error: error as Error | null };
}

export async function updateAuthSession(
  supabase: SupabaseClient,
  id: string,
  updates: Partial<Pick<IntegrationAuthSessionRow, "status" | "callback_received_at" | "error_json">>
): Promise<{ error: Error | null }> {
  const { error } = await supabase
    .from("integration_auth_sessions")
    .update(updates)
    .eq("id", id);
  return { error: error as Error | null };
}
