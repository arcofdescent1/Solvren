/**
 * Phase 2 — HubSpot health checks.
 */
import type { IntegrationHealthReport } from "../../contracts/runtime";

export function buildHubSpotHealth(
  authOk: boolean,
  apiOk: boolean,
  lastSuccessAt: string | null
): IntegrationHealthReport {
  const dimensions: Record<string, "healthy" | "degraded" | "unhealthy" | "unknown"> = {
    auth: authOk ? "healthy" : "unhealthy",
    api_reachability: apiOk ? "healthy" : "unhealthy",
    sync_freshness: lastSuccessAt ? "healthy" : "unknown",
    webhook_health: "unknown",
  };
  const status = !authOk || !apiOk ? "unhealthy" : "healthy";
  return {
    status,
    dimensions,
    lastCheckedAt: new Date().toISOString(),
  };
}
