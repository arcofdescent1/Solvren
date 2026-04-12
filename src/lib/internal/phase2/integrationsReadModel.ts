/**
 * Phase 2 — canonical integration row derivation (internal API only).
 * @see Phase 2 Resolution Appendix §1
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { getRegistryRuntime } from "@/modules/integrations/registry";
import type { IntegrationProvider } from "@/modules/integrations/contracts/types";
import { hasProvider } from "@/modules/integrations/registry/providerRegistry";

export type ConnectionStatus =
  | "connected"
  | "disconnected"
  | "needs_reauth"
  | "misconfigured"
  | "unknown";

export type SyncStatus = "healthy" | "warning" | "failed" | "never_synced" | "disabled" | "unknown";

export type MappingStatus = "configured" | "incomplete" | "invalid" | "not_applicable" | "unknown";

export type HealthRollup = "healthy" | "warning" | "critical";

export type CanonicalIntegrationItem = {
  integrationId: string;
  provider: string;
  connectionStatus: ConnectionStatus;
  syncStatus: SyncStatus;
  mappingStatus: MappingStatus;
  healthRollup: HealthRollup;
  lastHealthCheckAt: string | null;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  lastErrorCode: string | null;
  lastErrorSummary: string | null;
  disabled: boolean;
  source: "integration_accounts" | "integration_connections";
};

function mapAccountStatusToConnectionStatus(s: string): ConnectionStatus {
  const u = (s ?? "").toLowerCase();
  if (u === "connected" || u === "connected_limited" || u === "action_limited" || u === "degraded" || u === "syncing") {
    return "connected";
  }
  if (u === "auth_expired") return "needs_reauth";
  if (u === "disconnected") return "disconnected";
  if (u === "error") return "misconfigured";
  if (u === "installing" || u === "not_installed") return "unknown";
  return "unknown";
}

function mapLegacyConnectionStatus(s: string): ConnectionStatus {
  const u = (s ?? "").toLowerCase();
  if (u === "connected") return "connected";
  if (u === "disconnected") return "disconnected";
  if (u === "error") return "misconfigured";
  return "unknown";
}

function parseHealthSummarySync(
  health: Record<string, unknown> | null | undefined,
  legacyHealth: string | null | undefined,
  accountStatus: string,
  lastSuccessAt: string | null,
  lastErrorAt: string | null,
  lastErrorMessage: string | null,
  disabled: boolean
): SyncStatus {
  if (disabled) return "disabled";
  const h = health ?? {};
  const overall = typeof h.overall === "string" ? h.overall.toLowerCase() : "";
  const status = typeof h.status === "string" ? h.status.toLowerCase() : overall;
  if (status === "healthy" || status === "connected") return "healthy";
  if (status === "degraded" || status === "warning") return "warning";
  if (status === "unhealthy" || status === "error" || status === "failed") return "failed";

  const lh = (legacyHealth ?? "").toLowerCase();
  if (lh === "healthy") return "healthy";
  if (lh === "degraded") return "warning";
  if (lh === "error") return "failed";

  if (lastErrorAt && (!lastSuccessAt || new Date(lastErrorAt) > new Date(lastSuccessAt))) return "failed";
  if (lastSuccessAt) return "healthy";
  if ((accountStatus ?? "").toLowerCase() === "connected" && !lastSuccessAt) return "never_synced";
  return "unknown";
}

function deriveMappingStatus(
  provider: string,
  configJson: Record<string, unknown> | null | undefined,
  scopesMissing: unknown[] | null | undefined
): MappingStatus {
  if (!hasProvider(provider)) return "not_applicable";
  const missing = scopesMissing?.length ?? 0;
  if (missing > 0) return "incomplete";
  const cfg = configJson ?? {};
  if (Object.keys(cfg).length === 0) return "incomplete";
  return "configured";
}

function deriveHealthRollup(
  connectionStatus: ConnectionStatus,
  syncStatus: SyncStatus,
  mappingStatus: MappingStatus
): HealthRollup {
  if (
    connectionStatus === "disconnected" ||
    connectionStatus === "needs_reauth" ||
    connectionStatus === "misconfigured" ||
    syncStatus === "failed"
  ) {
    return "critical";
  }
  if (syncStatus === "warning" || mappingStatus === "incomplete" || mappingStatus === "invalid") {
    return "warning";
  }
  if (
    (connectionStatus === "connected" || connectionStatus === "unknown") &&
    (syncStatus === "healthy" || syncStatus === "never_synced") &&
    (mappingStatus === "configured" || mappingStatus === "not_applicable")
  ) {
    return "healthy";
  }
  if (syncStatus === "healthy" && connectionStatus === "connected" && mappingStatus === "configured") {
    return "healthy";
  }
  return "warning";
}

export type ResolvedIntegrationTarget =
  | { kind: "account"; accountId: string; orgId: string; provider: string }
  | { kind: "connection"; connectionId: string; orgId: string; provider: string };

export async function resolveIntegrationTarget(
  admin: SupabaseClient,
  orgId: string,
  integrationId: string
): Promise<ResolvedIntegrationTarget | null> {
  const { data: acc } = await admin
    .from("integration_accounts")
    .select("id, org_id, provider")
    .eq("id", integrationId)
    .maybeSingle();
  if (acc && (acc as { org_id: string }).org_id === orgId) {
    return {
      kind: "account",
      accountId: (acc as { id: string }).id,
      orgId,
      provider: String((acc as { provider: string }).provider),
    };
  }
  const { data: conn } = await admin
    .from("integration_connections")
    .select("id, org_id, provider")
    .eq("id", integrationId)
    .maybeSingle();
  if (conn && (conn as { org_id: string }).org_id === orgId) {
    return {
      kind: "connection",
      connectionId: (conn as { id: string }).id,
      orgId,
      provider: String((conn as { provider: string }).provider),
    };
  }
  return null;
}

export async function listCanonicalIntegrations(
  admin: SupabaseClient,
  orgId: string
): Promise<{ items: CanonicalIntegrationItem[]; summary: { total: number; healthy: number; warning: number; critical: number } }> {
  const [{ data: accounts }, { data: connections }] = await Promise.all([
    admin.from("integration_accounts").select("*").eq("org_id", orgId),
    admin.from("integration_connections").select("*").eq("org_id", orgId),
  ]);

  const accRows = (accounts ?? []) as Record<string, unknown>[];
  const connRows = (connections ?? []) as Record<string, unknown>[];
  const byProvider = new Map<string, Record<string, unknown>>();
  for (const a of accRows) {
    byProvider.set(String(a.provider), a);
  }

  const items: CanonicalIntegrationItem[] = [];

  for (const [provider, acc] of byProvider) {
    const conn = connRows.find((c) => String(c.provider) === provider);
    const status = String(acc.status ?? "not_installed");
    const disconnectedAt = acc.disconnected_at as string | null;
    const disabled = status === "disconnected" || disconnectedAt != null;
    const connectionStatus = mapAccountStatusToConnectionStatus(status);
    const healthJson = (acc.health_summary_json as Record<string, unknown>) ?? {};
    const lastSuccess = (acc.last_success_at as string | null) ?? (conn?.last_success_at as string | null) ?? null;
    const lastErrAt = (acc.last_error_at as string | null) ?? null;
    const lastErrMsg = (acc.last_error_message as string | null) ?? (conn?.last_error as string | null) ?? null;
    const syncStatus = parseHealthSummarySync(
      healthJson,
      (conn?.health_status as string | null) ?? null,
      status,
      lastSuccess,
      lastErrAt,
      lastErrMsg,
      disabled
    );
    const mappingStatus = deriveMappingStatus(
      provider,
      acc.config_json as Record<string, unknown>,
      acc.scopes_missing_json as unknown[]
    );
    const lastErrorCode = (acc.last_error_code as string | null) ?? null;
    const rollup = deriveHealthRollup(connectionStatus, syncStatus, mappingStatus);
    items.push({
      integrationId: String(acc.id),
      provider,
      connectionStatus,
      syncStatus,
      mappingStatus,
      healthRollup: rollup,
      lastHealthCheckAt: (healthJson.lastCheckedAt as string | null) ?? null,
      lastSuccessAt: lastSuccess,
      lastFailureAt: lastErrAt,
      lastErrorCode,
      lastErrorSummary: lastErrMsg ? String(lastErrMsg).slice(0, 200) : null,
      disabled,
      source: "integration_accounts",
    });
  }

  for (const c of connRows) {
    const p = String(c.provider);
    if (byProvider.has(p)) continue;
    const st = String(c.status ?? "disconnected");
    const connectionStatus = mapLegacyConnectionStatus(st);
    const disabled = st === "disconnected";
    const syncStatus = parseHealthSummarySync(
      {},
      c.health_status as string | null,
      st,
      (c.last_success_at as string | null) ?? null,
      null,
      (c.last_error as string | null) ?? null,
      disabled
    );
    const mappingStatus: MappingStatus = "not_applicable";
    const rollup = deriveHealthRollup(connectionStatus, syncStatus, mappingStatus);
    items.push({
      integrationId: String(c.id),
      provider: p,
      connectionStatus,
      syncStatus,
      mappingStatus,
      healthRollup: rollup,
      lastHealthCheckAt: null,
      lastSuccessAt: (c.last_success_at as string | null) ?? null,
      lastFailureAt: null,
      lastErrorCode: null,
      lastErrorSummary: c.last_error ? String(c.last_error).slice(0, 200) : null,
      disabled,
      source: "integration_connections",
    });
  }

  items.sort((a, b) => {
    const order = { critical: 0, warning: 1, healthy: 2 };
    return order[a.healthRollup] - order[b.healthRollup];
  });

  const summary = {
    total: items.length,
    healthy: items.filter((i) => i.healthRollup === "healthy").length,
    warning: items.filter((i) => i.healthRollup === "warning").length,
    critical: items.filter((i) => i.healthRollup === "critical").length,
  };

  return { items, summary };
}

export async function runIntegrationHealthCheck(
  admin: SupabaseClient,
  target: ResolvedIntegrationTarget
): Promise<"completed" | "queued"> {
  if (target.kind !== "account") {
    return "completed";
  }
  const { data: acc } = await admin.from("integration_accounts").select("*").eq("id", target.accountId).maybeSingle();
  if (!acc) return "completed";
  const provider = String((acc as { provider: string }).provider);
  if (!hasProvider(provider)) return "completed";
  try {
    const runtime = getRegistryRuntime(provider as IntegrationProvider);
    await runtime.getHealth({ orgId: target.orgId, integrationAccountId: target.accountId });
  } catch {
    /* ignore provider errors — health check best effort */
  }
  return "completed";
}

export async function generateReconnectAuthUrl(
  admin: SupabaseClient,
  params: { orgId: string; employeeUserId: string; provider: string; appOrigin: string }
): Promise<{ authUrl: string } | { error: "unsupported" }> {
  const provider = params.provider;
  if (!hasProvider(provider)) return { error: "unsupported" };
  const { startConnect } = await import("@/modules/integrations/auth/connectionManager");
  const { randomUUID } = await import("crypto");
  const stateToken = randomUUID();
  const redirectUri = `${params.appOrigin}/api/integrations/${provider}/connect/callback`;
  const result = await startConnect(admin, {
    orgId: params.orgId,
    userId: params.employeeUserId,
    provider: provider as IntegrationProvider,
    redirectUri,
    stateToken,
  });
  if (result.error || !result.authUrl) return { error: "unsupported" };
  return { authUrl: result.authUrl };
}
