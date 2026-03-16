"use client";

import { useEffect, useState } from "react";
import { Card, CardBody, CardHeader, CardTitle } from "@/ui/primitives/card";

type Stats = {
  requestsToday: number;
  averageLatencyMs: number | null;
  estimatedCostCents: number | null;
  error?: string;
};

export function AiUsageCard() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    fetch("/api/admin/ai-usage")
      .then((r) => r.json())
      .then((j) => setStats(j))
      .catch(() => setStats({ requestsToday: 0, averageLatencyMs: null, estimatedCostCents: null }));
  }, []);

  if (stats == null) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>AI usage</CardTitle>
        </CardHeader>
        <CardBody>
          <p className="text-sm text-[var(--text-muted)]">Loading…</p>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>AI usage</CardTitle>
      </CardHeader>
      <CardBody className="space-y-2 text-sm">
        <p>
          <span className="text-[var(--text-muted)]">Requests today:</span>{" "}
          <span className="font-medium">{stats.requestsToday}</span>
        </p>
        <p>
          <span className="text-[var(--text-muted)]">Avg latency:</span>{" "}
          <span className="font-medium">
            {stats.averageLatencyMs != null ? `${stats.averageLatencyMs} ms` : "—"}
          </span>
        </p>
        <p>
          <span className="text-[var(--text-muted)]">Est. cost (today):</span>{" "}
          <span className="font-medium">
            {stats.estimatedCostCents != null ? `$${stats.estimatedCostCents.toFixed(2)}` : "—"}
          </span>
        </p>
        {stats.error && (
          <p className="text-xs text-[var(--text-muted)]">{stats.error}</p>
        )}
      </CardBody>
    </Card>
  );
}
