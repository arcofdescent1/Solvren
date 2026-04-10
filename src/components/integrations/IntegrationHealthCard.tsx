"use client";

import { Card, CardBody } from "@/ui";

export type HealthStatus = "healthy" | "degraded" | "error" | null;

type IntegrationHealthCardProps = {
  healthStatus: HealthStatus;
  lastSuccessAt: string | null;
  lastError: string | null;
  pendingRetries?: number;
};

const HEALTH_BADGES: Record<NonNullable<HealthStatus>, { label: string; className: string }> = {
  healthy: { label: "Healthy", className: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" },
  degraded: { label: "Degraded", className: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400" },
  error: { label: "Error", className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400" },
};

export function IntegrationHealthCard({
  healthStatus,
  lastSuccessAt,
  lastError,
  pendingRetries = 0,
}: IntegrationHealthCardProps) {
  const badge = healthStatus ? HEALTH_BADGES[healthStatus] : null;

  return (
    <Card>
      <CardBody className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-[var(--text-muted)]">Connection status</span>
          {badge ? (
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${badge.className}`}>
              {badge.label}
            </span>
          ) : (
            <span className="text-xs text-[var(--text-muted)]">—</span>
          )}
        </div>
        {lastSuccessAt && (
          <p className="text-xs text-[var(--text-muted)]">
            Last verified: {new Date(lastSuccessAt).toLocaleString()}
          </p>
        )}
        {lastError && (
          <p className="text-sm text-red-600 dark:text-red-400">{lastError}</p>
        )}
        {pendingRetries > 0 && (
          <p className="text-xs text-[var(--text-muted)]">
            {pendingRetries} pending retr{pendingRetries === 1 ? "y" : "ies"}
          </p>
        )}
        <p className="text-xs text-[var(--text-muted)]">
          Use &quot;Test connection&quot; to verify authentication and API access.
        </p>
      </CardBody>
    </Card>
  );
}
