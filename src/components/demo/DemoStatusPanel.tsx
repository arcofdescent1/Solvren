"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge, Card, CardBody, CardHeader, CardTitle } from "@/ui";
import type { DemoStatus } from "./DemoEnvironmentBanner";

export function DemoStatusPanel() {
  const [status, setStatus] = useState<DemoStatus | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/demo/status");
      if (res.ok) setStatus(await res.json());
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
  const validationVariant =
    status.validationStatus === "healthy"
      ? "success"
      : status.validationStatus === "degraded"
        ? "warning"
        : "outline";

  return (
    <Card>
      <CardHeader>
        <CardTitle>Demo status</CardTitle>
      </CardHeader>
      <CardBody>
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-[var(--text-muted)]">Scenario</dt>
            <dd>{scenarioName}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-[var(--text-muted)]">Seed version</dt>
            <dd>{status.seedVersion ?? "-"}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-[var(--text-muted)]">Last reset</dt>
            <dd>{status.lastResetAt ? new Date(status.lastResetAt).toLocaleString() : "-"}</dd>
          </div>
          <div className="flex items-center justify-between gap-4">
            <dt className="text-[var(--text-muted)]">Data health</dt>
            <dd>
              <Badge variant={validationVariant}>{status.validationStatus ?? "unknown"}</Badge>
            </dd>
          </div>
        </dl>
      </CardBody>
    </Card>
  );
}
