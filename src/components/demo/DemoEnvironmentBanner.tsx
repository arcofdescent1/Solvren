"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge, Button } from "@/ui";

export type DemoStatus = {
  orgId: string;
  isDemoOrg: boolean;
  scenarioKey: string | null;
  seedVersion: string | null;
  lastResetAt: string | null;
  validationStatus: string | null;
};

export function DemoEnvironmentBanner() {
  const [status, setStatus] = useState<DemoStatus | null>(null);
  const [resetting, setResetting] = useState(false);

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
    fetchStatus();
  }, [fetchStatus]);

  const handleReset = useCallback(async () => {
    if (!status?.isDemoOrg || !status?.scenarioKey || resetting) return;
    setResetting(true);
    try {
      const res = await fetch("/api/demo/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenarioKey: status.scenarioKey, resetMode: "full" }),
      });
      if (res.ok) await fetchStatus();
    } finally {
      setResetting(false);
    }
  }, [status, resetting, fetchStatus]);

  if (!status?.isDemoOrg) return null;

  const scenarioName = status.scenarioKey
    ? status.scenarioKey.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
    : "Demo";

  return (
    <div className="px-4 pt-4">
      <div
        className="mx-auto flex max-w-7xl flex-col gap-3 rounded-[var(--radius-lg)] border border-[var(--primary)]/20 bg-[color:color-mix(in_oklab,var(--bg-surface)_96%,var(--bg-app))] px-4 py-3 shadow-[var(--shadow-sm)] sm:flex-row sm:items-center sm:justify-between"
        role="status"
      >
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <Badge variant="warning">Demo</Badge>
          <span className="truncate text-sm font-semibold text-[var(--text)]">{scenarioName}</span>
          {status.seedVersion ? (
            <span className="text-xs text-[var(--text-muted)]">Seed {status.seedVersion}</span>
          ) : null}
          <span className="hidden text-xs text-[var(--text-muted)] md:inline">
            Synthetic workspace for guided product walkthroughs.
          </span>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleReset}
          disabled={resetting}
          className="h-9 self-start sm:self-auto"
        >
          {resetting ? "Resetting..." : "Reset demo"}
        </Button>
      </div>
    </div>
  );
}
