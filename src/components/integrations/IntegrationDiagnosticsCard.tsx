"use client";

import { Card, CardBody } from "@/ui";

/**
 * Gap 3 — Diagnostics section for integration detail pages.
 * Shows connection status, last verified, last error; supports optional extra rows (e.g. from test run).
 */
export type IntegrationDiagnosticsCardProps = {
  healthStatus: "healthy" | "degraded" | "error" | "disconnected" | null;
  lastSuccessAt: string | null;
  lastError: string | null;
  /** Optional rows e.g. [{ label: "Authentication", value: "OK" }] */
  rows?: Array<{ label: string; value: string }>;
};

const STATUS_LABEL: Record<string, string> = {
  healthy: "Healthy",
  degraded: "Degraded",
  error: "Error",
  disconnected: "Disconnected",
};

export function IntegrationDiagnosticsCard({
  healthStatus,
  lastSuccessAt,
  lastError,
  rows = [],
}: IntegrationDiagnosticsCardProps) {
  const statusLabel = healthStatus ? STATUS_LABEL[healthStatus] ?? healthStatus : "—";

  return (
    <Card>
      <CardBody className="space-y-4">
        <h3 className="text-sm font-semibold text-[var(--text)]">Diagnostics</h3>
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-[var(--text-muted)]">Connection status</dt>
            <dd className="font-medium text-[var(--text)]">{statusLabel}</dd>
          </div>
          {lastSuccessAt && (
            <div className="flex justify-between gap-4">
              <dt className="text-[var(--text-muted)]">Last verified</dt>
              <dd className="text-[var(--text)]">{new Date(lastSuccessAt).toLocaleString()}</dd>
            </div>
          )}
          {rows.map((r, i) => (
            <div key={i} className="flex justify-between gap-4">
              <dt className="text-[var(--text-muted)]">{r.label}</dt>
              <dd className="text-[var(--text)]">{r.value}</dd>
            </div>
          ))}
        </dl>
        {lastError && (
          <p className="rounded border border-[var(--danger)]/30 bg-[var(--danger)]/5 px-3 py-2 text-sm text-[var(--danger)]">
            Last error: {lastError}
          </p>
        )}
        <p className="text-xs text-[var(--text-muted)]">
          Use &quot;Test connection&quot; below to verify authentication and API access.
        </p>
      </CardBody>
    </Card>
  );
}
