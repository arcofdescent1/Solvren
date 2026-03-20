"use client";

/**
 * Phase 10 — Playbook performance detail client.
 */
import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/ui/primitives/badge";
import { Card, CardBody } from "@/ui/primitives/card";

type Props = { playbookKey: string };

export function PlaybookPerformanceDetailClient({ playbookKey }: Props) {
  const [data, setData] = useState<{
    displayName: string;
    healthState: string;
    performanceScore: number;
    recoveredAmount: number;
    avoidedAmount: number;
    savingsAmount: number;
    runCount: number;
    successCount: number;
    failureCount: number;
    verificationSuccessRate: number | null;
    automationRate: number | null;
    avgTimeToResolutionSeconds: number | null;
    trend: Array<{ windowEnd: string; performanceScore: number; recoveredAmount: number; runCount: number }>;
  } | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/playbooks/performance/${encodeURIComponent(playbookKey)}`);
      if (res.ok) {
        const d = await res.json();
        setData(d);
      }
    } catch {
      setData(null);
    }
  }, [playbookKey]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (!data) {
    return <p className="text-sm text-[color:var(--rg-text-muted)]">Loading…</p>;
  }

  const healthVariant =
    data.healthState === "HEALTHY" ? "success" : data.healthState === "DEGRADED" ? "warning" : data.healthState === "BLOCKED" ? "danger" : "secondary";

  return (
    <div className="space-y-6">
      <Card>
        <CardBody>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">{data.displayName}</h2>
            <Badge variant={healthVariant}>{data.healthState}</Badge>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div>
              <p className="text-xs text-[color:var(--rg-text-muted)]">Performance Score</p>
              <p className="text-xl font-semibold">{data.performanceScore}</p>
            </div>
            <div>
              <p className="text-xs text-[color:var(--rg-text-muted)]">Recovered</p>
              <p className="text-xl font-semibold">${data.recoveredAmount.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-xs text-[color:var(--rg-text-muted)]">Avoided</p>
              <p className="text-xl font-semibold">${data.avoidedAmount.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-xs text-[color:var(--rg-text-muted)]">Runs</p>
              <p className="text-xl font-semibold">{data.runCount}</p>
            </div>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          <h3 className="mb-4 text-sm font-semibold">Run Summary</h3>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div>
              <p className="text-xs text-[color:var(--rg-text-muted)]">Success</p>
              <p className="font-medium">{data.successCount}</p>
            </div>
            <div>
              <p className="text-xs text-[color:var(--rg-text-muted)]">Failure</p>
              <p className="font-medium">{data.failureCount}</p>
            </div>
            <div>
              <p className="text-xs text-[color:var(--rg-text-muted)]">Verification Rate</p>
              <p className="font-medium">{data.verificationSuccessRate != null ? `${(data.verificationSuccessRate * 100).toFixed(0)}%` : "—"}</p>
            </div>
            <div>
              <p className="text-xs text-[color:var(--rg-text-muted)]">Automation Rate</p>
              <p className="font-medium">{data.automationRate != null ? `${(data.automationRate * 100).toFixed(0)}%` : "—"}</p>
            </div>
          </div>
        </CardBody>
      </Card>

      {data.trend.length > 0 && (
        <Card>
          <CardBody>
            <h3 className="mb-4 text-sm font-semibold">Trend</h3>
            <div className="space-y-2">
              {data.trend.map((t, i) => (
                <div key={i} className="flex items-center justify-between rounded border border-[color:var(--rg-border)] px-3 py-2 text-sm">
                  <span>{new Date(t.windowEnd).toLocaleDateString()}</span>
                  <span>Score: {t.performanceScore} | Recovered: ${t.recoveredAmount.toLocaleString()} | Runs: {t.runCount}</span>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
