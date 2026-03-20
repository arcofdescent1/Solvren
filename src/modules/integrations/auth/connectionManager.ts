/**
 * Phase 1 — Connection Manager: auth start/callback/refresh/disconnect (§5.1, §20.4).
 * Persists auth sessions and creates integration_accounts on successful callback.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { getRegistryRuntime } from "../registry";
import { getProviderManifest } from "../registry/getProviderManifest";
import type { IntegrationProvider } from "../contracts/types";
import {
  getAccountById,
  getAccountByOrgAndProvider,
  insertIntegrationAccount,
  updateIntegrationAccount,
} from "../core/integrationAccountsRepo";
import { insertCredential } from "../core/integrationCredentialsRepo";
import {
  insertAuthSession,
  getAuthSessionByStateToken,
  updateAuthSession,
} from "../core/integrationAuthSessionsRepo";

const SESSION_TTL_MINUTES = 15;

export type StartConnectParams = {
  orgId: string;
  userId: string;
  provider: IntegrationProvider;
  redirectUri: string;
  stateToken: string;
  pkceVerifier?: string;
  requestedScopes?: string[];
};

export async function startConnect(
  supabase: SupabaseClient,
  params: StartConnectParams
): Promise<{ authUrl: string; stateToken: string; error?: string }> {
  const manifest = getProviderManifest(params.provider as string);
  if (!manifest) return { authUrl: "", stateToken: params.stateToken, error: "Unknown provider" };

  const expiresAt = new Date(Date.now() + SESSION_TTL_MINUTES * 60 * 1000).toISOString();
  const { data: session, error: sessionError } = await insertAuthSession(supabase, {
    org_id: params.orgId,
    provider: params.provider,
    initiated_by_user_id: params.userId,
    state_token: params.stateToken,
    pkce_verifier: params.pkceVerifier ?? null,
    redirect_uri: params.redirectUri,
    requested_scopes_json: params.requestedScopes ?? manifest.requiredScopes,
    status: "pending",
    expires_at: expiresAt,
    callback_received_at: null,
    error_json: null,
  });
  if (sessionError || !session) {
    return { authUrl: "", stateToken: params.stateToken, error: sessionError?.message ?? "Failed to create session" };
  }

  const runtime = getRegistryRuntime(params.provider);
  const result = await runtime.connect({
    orgId: params.orgId,
    userId: params.userId,
    redirectUri: params.redirectUri,
    stateToken: params.stateToken,
    pkceVerifier: params.pkceVerifier,
    requestedScopes: params.requestedScopes ?? manifest.requiredScopes,
  });
  return {
    authUrl: result.authUrl,
    stateToken: result.stateToken,
  };
}

export type HandleCallbackParams = {
  provider: IntegrationProvider;
  stateToken: string;
  code?: string;
  error?: string;
  errorDescription?: string;
};

export async function handleCallback(
  supabase: SupabaseClient,
  params: HandleCallbackParams
): Promise<{
  success: boolean;
  redirectUri?: string;
  integrationAccountId?: string;
  errorCode?: string;
  errorMessage?: string;
}> {
  const { data: session, error: sessionErr } = await getAuthSessionByStateToken(supabase, params.stateToken);
  if (sessionErr || !session) {
    return { success: false, errorCode: "invalid_state", errorMessage: "Session not found or expired" };
  }
  if (session.status !== "pending") {
    return { success: false, errorCode: "session_used", errorMessage: "This authorization was already used" };
  }
  if (new Date(session.expires_at) < new Date()) {
    await updateAuthSession(supabase, session.id, { status: "expired" });
    return { success: false, errorCode: "expired", errorMessage: "Authorization session expired" };
  }
  if (session.provider !== params.provider) {
    return { success: false, errorCode: "provider_mismatch", errorMessage: "Provider mismatch" };
  }

  await updateAuthSession(supabase, session.id, { callback_received_at: new Date().toISOString() });

  const runtime = getRegistryRuntime(params.provider);
  const result = await runtime.handleCallback({
    orgId: session.org_id,
    provider: params.provider,
    stateToken: params.state_token,
    code: params.code,
    error: params.error,
    errorDescription: params.errorDescription,
  });

  if (!result.success) {
    await updateAuthSession(supabase, session.id, {
      status: "failed",
      error_json: { code: result.errorCode, message: result.errorMessage },
    });
    return {
      success: false,
      redirectUri: session.redirect_uri,
      errorCode: result.errorCode ?? "callback_failed",
      errorMessage: result.errorMessage,
    };
  }

  const manifest = getProviderManifest(params.provider as string);
  const displayName = result.displayName ?? manifest?.displayName ?? params.provider;
  const category = manifest?.category ?? "crm";
  const authType = manifest?.authType ?? "oauth2";

  let accountId = result.integrationAccountId;
  if (!accountId && (result.displayName ?? result.config ?? result.tokenRef)) {
    const { data: existing } = await getAccountByOrgAndProvider(supabase, session.org_id, params.provider);
    if (existing) {
      await updateIntegrationAccount(supabase, existing.id, {
        status: "connected",
        installed_at: new Date().toISOString(),
        installed_by_user_id: session.initiated_by_user_id,
        disconnected_at: null,
        last_success_at: new Date().toISOString(),
        last_error_at: null,
        last_error_code: null,
        last_error_message: null,
        scopes_granted_json: result.scopesGranted ?? [],
        scopes_missing_json: result.scopesMissing ?? [],
        config_json: result.config ?? {},
      });
      accountId = existing.id;
    } else {
      const { data: newAccount, error: insertErr } = await insertIntegrationAccount(supabase, {
        org_id: session.org_id,
        provider: params.provider,
        display_name: displayName,
        category,
        auth_type: authType,
        status: "connected",
        connection_mode: "oauth",
        installed_by_user_id: session.initiated_by_user_id,
        installed_at: new Date().toISOString(),
        disconnected_at: null,
        last_success_at: new Date().toISOString(),
        last_error_at: null,
        last_error_code: null,
        last_error_message: null,
        health_summary_json: {},
        scopes_granted_json: result.scopesGranted ?? [],
        scopes_missing_json: result.scopesMissing ?? [],
        config_json: result.config ?? {},
        secrets_ref: result.tokenRef ?? null,
        metadata_json: {},
      });
      if (insertErr || !newAccount) {
        await updateAuthSession(supabase, session.id, {
          status: "failed",
          error_json: { code: "create_account_failed", message: insertErr?.message },
        });
        return {
          success: false,
          redirectUri: session.redirect_uri,
          errorCode: "create_account_failed",
          errorMessage: insertErr?.message ?? "Failed to create integration account",
        };
      }
      accountId = newAccount.id;
      if (result.tokenRef) {
        await insertCredential(supabase, {
          integration_account_id: newAccount.id,
          credential_type: "access_token",
          secret_ref: result.tokenRef,
          expires_at: result.tokenExpiresAt ?? null,
          refreshable: result.refreshable ?? false,
          last_refreshed_at: null,
        });
      }
    }
  }

  await updateAuthSession(supabase, session.id, { status: "completed" });
  return {
    success: true,
    redirectUri: session.redirect_uri,
    integrationAccountId: accountId,
  };
}

export async function disconnectIntegration(
  supabase: SupabaseClient,
  params: { orgId: string; integrationAccountId: string; userId: string }
): Promise<{ error?: string }> {
  const { data: account } = await getAccountById(supabase, params.integrationAccountId);
  if (!account) return { error: "Account not found" };
  if (account.org_id !== params.orgId) return { error: "Forbidden" };

  const runtime = getRegistryRuntime(account.provider as IntegrationProvider);
  await runtime.disconnect({
    orgId: params.orgId,
    integrationAccountId: params.integrationAccountId,
    userId: params.userId,
  });
  await updateIntegrationAccount(supabase, params.integrationAccountId, {
    status: "disconnected",
    disconnected_at: new Date().toISOString(),
  });
  return {};
}
