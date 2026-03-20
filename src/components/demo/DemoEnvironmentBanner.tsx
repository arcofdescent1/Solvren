"use client";

/**
 * Phase 8 — Demo environment banner.
 * Always visible in demo orgs. Shows DEMO badge, scenario name, reset button.
 */
import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/ui/primitives/button";

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
      if (res.ok) {
        await fetchStatus();
      }
    } finally {
      setResetting(false);
    }
  }, [status, resetting, fetchStatus]);

  if (!status?.isDemoOrg) return null;

  const scenarioName = status.scenarioKey
    ? status.scenarioKey.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
    : "Demo";

  return (
    <div className="flex items-center justify-between gap-3 border-b border-[color:var(--rg-border)] bg-[color:var(--rg-panel-2)] px-4 py-2">
      <div className="flex items-center gap-2">
        <Badge tone="warning">DEMO</Badge>
        <span className="text-sm text-[color:var(--rg-text-muted)]">
          {scenarioName}
          {status.seedVersion && ` @ ${status.seedVersion}`}
        </span>
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={handleReset}
        disabled={resetting}
      >
        {resetting ? "Resetting…" : "Reset Demo"}
      </Button>
    </div>
  );
}
