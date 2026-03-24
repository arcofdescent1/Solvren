/**
 * Jira OAuth auth service — canonical boundary for Jira connect lifecycle.
 * Owns: authorize URL, token exchange, accessible resources, connection persistence,
 * token refresh, and auth error marking.
 * @see Phase 3 — Jira Production Hardening
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";
import { signJiraState } from "@/lib/jira/state";
import { JIRA_OAUTH_SCOPE_STRING } from "@/lib/jira/constants";
import { IntegrationConnectionService } from "@/modules/integrations";
import { IntegrationHealthService } from "@/modules/integrations";
import { revealCredentialTokenFields, sealCredentialTokenFields } from "@/lib/server/integrationTokenFields";

const REFRESH_THRESHOLD_MS = 10 * 60 * 1000;

export type JiraCredentials = {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: string | null;
};

export type JiraAccessibleResource = {
  id: string;
  name: string;
  url?: string;
  scopes?: string[];
};

export class JiraAuthService {
  constructor(private admin: SupabaseClient) {}

  /** Build Atlassian authorize URL for OAuth connect. */
  buildAuthorizeUrl(
    orgId: string,
    userId: string,
    baseUrl: string,
    opts?: { returnTo?: string }
  ): string {
    const clientId = env.jiraClientId;
    if (!clientId) throw new Error("Jira not configured: missing JIRA_CLIENT_ID");
    const redirectUri =
      env.jiraRedirectUri ?? `${baseUrl.replace(/\/$/, "")}/api/integrations/jira/callback`;
    const state = signJiraState({
      orgId,
      userId,
      returnTo: opts?.returnTo,
    });
    const url = new URL("https://auth.atlassian.com/authorize");
    url.searchParams.set("audience", "api.atlassian.com");
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("scope", JIRA_OAUTH_SCOPE_STRING);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("state", state);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("prompt", "consent");
    return url.toString();
  }

  /** Exchange authorization code for tokens. */
  async exchangeCodeForTokens(
    code: string,
    redirectUri: string
  ): Promise<{ access_token: string; refresh_token?: string; expires_in?: number }> {
    const clientId = env.jiraClientId;
    const clientSecret = env.jiraClientSecret;
    if (!clientId || !clientSecret) throw new Error("Jira OAuth not configured");

    const body = new URLSearchParams();
    body.set("grant_type", "authorization_code");
    body.set("client_id", clientId);
    body.set("client_secret", clientSecret);
    body.set("code", code);
    body.set("redirect_uri", redirectUri);

    const res = await fetch("https://auth.atlassian.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });

    const json = (await res.json()) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
      error_description?: string;
    };
    if (!res.ok) {
      throw new Error(json.error_description ?? "OAuth token exchange failed");
    }
    const token = json.access_token;
    if (!token) throw new Error("No access_token in response");
    return {
      access_token: token,
      refresh_token: json.refresh_token,
      expires_in: json.expires_in,
    };
  }

  /** Fetch accessible Jira resources from Atlassian. Returns canonical id, name, url, scopes. */
  async getAccessibleResources(accessToken: string): Promise<JiraAccessibleResource[]> {
    const res = await fetch("https://api.atlassian.com/oauth/token/accessible-resources", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) throw new Error("Failed to fetch accessible resources");
    const data = (await res.json()) as Array<{ id?: string; name?: string; url?: string; scopes?: string[] }>;
    if (!Array.isArray(data)) return [];
    return data
      .filter((r) => r.id && r.name)
      .map((r) => ({ id: r.id!, name: r.name!, url: r.url, scopes: r.scopes }));
  }

  /** Use canonical siteUrl from resource.url; fallback only when url is missing. */
  static siteUrlFromResource(resource: JiraAccessibleResource): string {
    if (resource.url && typeof resource.url === "string" && resource.url.startsWith("http")) {
      return resource.url;
    }
    const slug = (resource.name ?? "").toLowerCase().replace(/\s+/g, "-");
    return slug ? `https://${slug}.atlassian.net` : "https://unknown.atlassian.net";
  }

  /** Persist connection: credentials + connection config with canonical metadata. */
  async persistConnection(
    orgId: string,
    tokens: { access_token: string; refresh_token?: string; expires_in?: number },
    resource: JiraAccessibleResource
  ): Promise<void> {
    const siteUrl = JiraAuthService.siteUrlFromResource(resource);
    const expiresAt = tokens.expires_in
      ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
      : null;

    await this.admin.from("integration_credentials").upsert(
      {
        org_id: orgId,
        provider: "jira",
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token ?? null,
        expires_at: expiresAt,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "org_id,provider" }
    );

    const connSvc = new IntegrationConnectionService(this.admin);
    await connSvc.upsertConnected(orgId, "jira", {
      cloudId: resource.id,
      resourceId: resource.id,
      siteName: resource.name,
      siteUrl,
      scopes: resource.scopes ?? [],
    });
  }

  /** Ensure valid token; refresh if near expiry. Uses IntegrationHealthService for health, not connection status. */
  async ensureValidJiraToken(orgId: string): Promise<JiraCredentials | null> {
    const { data: cred } = await this.admin
      .from("integration_credentials")
      .select("access_token, refresh_token, expires_at")
      .eq("org_id", orgId)
      .eq("provider", "jira")
      .maybeSingle();

    if (!cred) return null;

    const revealed = revealCredentialTokenFields(cred as Record<string, unknown>);
    const accessToken = String((revealed as { access_token?: string }).access_token ?? "");
    const refreshToken = (revealed as { refresh_token?: string | null }).refresh_token ?? null;
    const expiresAt = (revealed as { expires_at?: string | null }).expires_at ?? null;

    const needsRefresh =
      expiresAt && new Date(expiresAt).getTime() - Date.now() < REFRESH_THRESHOLD_MS;

    if (!needsRefresh || !refreshToken) {
      return { accessToken, refreshToken, expiresAt };
    }

    const clientId = env.jiraClientId;
    const clientSecret = env.jiraClientSecret;
    if (!clientId || !clientSecret) {
      await this.markAuthError(orgId, "jira.token_refresh.failed: missing credentials");
      return null;
    }

    const body = new URLSearchParams();
    body.set("grant_type", "refresh_token");
    body.set("client_id", clientId);
    body.set("client_secret", clientSecret);
    body.set("refresh_token", refreshToken);

    const res = await fetch("https://auth.atlassian.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });

    const json = (await res.json()) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
      error?: string;
      error_description?: string;
    };

    if (!res.ok) {
      const msg = json.error_description ?? json.error ?? "Token refresh failed";
      await this.markAuthError(orgId, `jira.token_refresh.failed: ${msg}`);
      return null;
    }

    const newExpiresAt = json.expires_in
      ? new Date(Date.now() + json.expires_in * 1000).toISOString()
      : null;

    await this.admin.from("integration_credentials").upsert(
      sealCredentialTokenFields({
        org_id: orgId,
        provider: "jira",
        access_token: json.access_token!,
        refresh_token: json.refresh_token ?? refreshToken,
        expires_at: newExpiresAt,
        updated_at: new Date().toISOString(),
      }),
      { onConflict: "org_id,provider" }
    );

    const healthSvc = new IntegrationHealthService(this.admin);
    await healthSvc.markHealthy(orgId, "jira");

    return {
      accessToken: json.access_token!,
      refreshToken: json.refresh_token ?? refreshToken,
      expiresAt: newExpiresAt,
    };
  }

  /** Mark auth/health error. Does NOT mutate connection status to "error" — use health only. */
  async markAuthError(orgId: string, msg: string): Promise<void> {
    const healthSvc = new IntegrationHealthService(this.admin);
    await healthSvc.markError(orgId, "jira", msg);
  }
}

/**
 * Get valid Jira credentials for org. Refreshes token if near expiry.
 * @deprecated Prefer `new JiraAuthService(admin).ensureValidJiraToken(orgId)`
 */
export async function ensureValidJiraToken(
  admin: SupabaseClient,
  orgId: string
): Promise<JiraCredentials | null> {
  const service = new JiraAuthService(admin);
  return service.ensureValidJiraToken(orgId);
}
