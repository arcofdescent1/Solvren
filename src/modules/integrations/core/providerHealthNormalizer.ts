/**
 * Phase 2 — Normalize provider health outputs.
 * Every provider reports: auth, connectivity, schema, sync, webhook, lastSuccessAt.
 */
import type { IntegrationHealthReport } from "../contracts/runtime";

export type NormalizedHealth = {
  auth: "healthy" | "failed";
  connectivity: "healthy" | "failed";
  schema: "available" | "failed";
  sync: "fresh" | "stale" | "failed";
  webhook: "healthy" | "degraded" | "missing";
  lastSuccessAt: string | null;
  status: "healthy" | "degraded" | "unhealthy";
};

export function normalizeHealth(report: IntegrationHealthReport): NormalizedHealth {
  const d = report.dimensions;
  return {
    auth: (d.auth === "healthy" ? "healthy" : "failed") as "healthy" | "failed",
    connectivity: (d.api_reachability === "healthy" ? "healthy" : "failed") as "healthy" | "failed",
    schema: (d.api_reachability === "healthy" ? "available" : "failed") as "available" | "failed",
    sync: mapSyncStatus(d.sync_freshness),
    webhook: mapWebhookStatus(d.webhook_health),
    lastSuccessAt: null,
    status: report.status,
  };
}

function mapSyncStatus(v: string | undefined): "fresh" | "stale" | "failed" {
  if (v === "healthy") return "fresh";
  if (v === "degraded") return "stale";
  return "failed";
}

function mapWebhookStatus(v: string | undefined): "healthy" | "degraded" | "missing" {
  if (v === "healthy") return "healthy";
  if (v === "degraded") return "degraded";
  return "missing";
}
