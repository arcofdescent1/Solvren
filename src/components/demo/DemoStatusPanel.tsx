"use client";

/**
 * Phase 8 — Demo status panel.
 */
import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import type { DemoStatus } from "./DemoEnvironmentBanner";

export function DemoStatusPanel() {
  const [status, setStatus] = useState<DemoStatus | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/demo/status");
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
      }
    } catch {
      setStatus(null);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      void fetchStatus();
    });
  }, [fetchStatus]);

  if (!status?.isDemoOrg) return null;

  const scenarioName = status.scenarioKey
    ? status.scenarioKey.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
    : "Demo";

  return (
    <div className="rounded-lg border border-[color:var(--rg-border)] bg-[color:var(--rg-panel)] p-4">
      <h3 className="mb-2 text-sm font-semibold text-[color:var(--rg-text)]">Demo Status</h3>
      <dl className="space-y-1 text-sm">
        <div className="flex justify-between gap-4">
          <dt className="text-[color:var(--rg-text-muted)]">Scenario</dt>
          <dd>{scenarioName}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-[color:var(--rg-text-muted)]">Seed Version</dt>
          <dd>{status.seedVersion ?? "—"}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-[color:var(--rg-text-muted)]">Last Reset</dt>
          <dd>
            {status.lastResetAt
              ? new Date(status.lastResetAt).toLocaleString()
              : "—"}
          </dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-[color:var(--rg-text-muted)]">Data Health</dt>
          <dd>
            <Badge
              tone={
                status.validationStatus === "healthy"
                  ? "success"
                  : status.validationStatus === "degraded"
                    ? "warning"
                    : "neutral"
              }
            >
              {status.validationStatus ?? "unknown"}
            </Badge>
          </dd>
        </div>
      </dl>
    </div>
  );
}
