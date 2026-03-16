"use client";

import { useEffect, useState } from "react";
import { Card, CardBody } from "@/ui";

type Snapshot = { metric_name: string; metric_value: number; snapshot_time: string };

export function MetricTrendCard() {
  const [period, setPeriod] = useState<"24h" | "7d" | "30d">("7d");
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);

  useEffect(() => {
    fetch(`/api/metrics/snapshots?period=${period}`)
      .then((r) => r.json())
      .then((j) => setSnapshots(Array.isArray(j.snapshots) ? j.snapshots : []))
      .catch(() => setSnapshots([]));
  }, [period]);

  const exposure = snapshots.filter((s) => s.metric_name === "revenue_exposure");
  const max = Math.max(0, ...exposure.map((s) => Number(s.metric_value)));
  const format = (n: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

  return (
    <Card>
      <CardBody className="py-4">
        <h3 className="text-sm font-medium uppercase tracking-wide text-[var(--text-muted)]">
          Revenue exposure trend
        </h3>
        <div className="mt-2 flex gap-2">
          {(["24h", "7d", "30d"] as const).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPeriod(p)}
              className={`rounded px-2 py-1 text-xs font-medium ${
                period === p
                  ? "bg-[var(--primary)] text-[var(--primary-contrast)]"
                  : "bg-[var(--bg-muted)] text-[var(--text-muted)] hover:bg-[var(--border)]"
              }`}
            >
              {p === "24h" ? "24 hours" : p === "7d" ? "7 days" : "30 days"}
            </button>
          ))}
        </div>
        {exposure.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--text-muted)]">No snapshot data yet. Snapshots run hourly.</p>
        ) : (
          <div className="mt-3 flex items-end gap-0.5" style={{ height: 48 }}>
            {exposure.slice(-24).map((s, i) => (
              <div
                key={i}
                className="min-w-[4px] flex-1 rounded-t bg-[var(--primary)]/60"
                style={{
                  height: max > 0 ? `${(Number(s.metric_value) / max) * 100}%` : "0%",
                }}
                title={`${new Date(s.snapshot_time).toLocaleString()}: ${format(Number(s.metric_value))}`}
              />
            ))}
          </div>
        )}
      </CardBody>
    </Card>
  );
}
