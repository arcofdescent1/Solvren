"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardBody, CardHeader, CardTitle, Badge } from "@/ui";

type InsightsPayload = {
  ok?: boolean;
  error?: string;
  growthPrompts?: Array<{
    title: string;
    description: string;
    href?: string;
    kind: string;
  }>;
  benchmarks?: Array<{
    metricKey: string;
    displayName: string;
    explanationText: string;
    safeToDisplay: boolean;
    percentileRank: number | null;
  }>;
  anomalies?: Array<{ id: string; title: string; detail: string; severity: string }>;
  intelligence?: { notes: string; issueConfidenceModifier: number };
};

export default function ExecutiveInsightsPanel() {
  const [data, setData] = useState<InsightsPayload | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    fetch("/api/insights")
      .then((r) => r.json())
      .then((j: InsightsPayload) => {
        if (!j || j.ok === false || j.error) setFailed(true);
        else setData(j);
      })
      .catch(() => setFailed(true));
  }, []);

  if (failed) return null;
  if (!data) {
    return (
      <Card>
        <CardBody>
          <p className="text-sm text-[var(--text-muted)]">Loading insights…</p>
        </CardBody>
      </Card>
    );
  }

  const benchmarks = (data.benchmarks ?? []).filter((b) => b.safeToDisplay).slice(0, 4);
  const anomalies = data.anomalies ?? [];
  const prompts = (data.growthPrompts ?? []).slice(0, 3);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Benchmarks vs cohort</CardTitle>
        </CardHeader>
        <CardBody className="space-y-3">
          {benchmarks.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)]">
              Benchmarks appear when cohort snapshots meet privacy thresholds.
            </p>
          ) : (
            benchmarks.map((b) => (
              <div
                key={b.metricKey}
                className="rounded-md border border-[var(--border)] p-3"
              >
                <p className="text-sm font-semibold text-[var(--text)]">{b.displayName}</p>
                <p className="mt-1 text-xs text-[var(--text-muted)]">{b.explanationText}</p>
                {b.percentileRank != null ? (
                  <Badge variant="secondary" className="mt-2">
                    ~p{b.percentileRank}
                  </Badge>
                ) : null}
              </div>
            ))
          )}
        </CardBody>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Insights & opportunities</CardTitle>
        </CardHeader>
        <CardBody className="space-y-3">
          {anomalies.length > 0 ? (
            <ul className="list-inside list-disc space-y-2 text-sm text-[var(--text)]">
              {anomalies.map((a) => (
                <li key={a.id}>
                  <span className="font-medium">{a.title}</span> — {a.detail}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-[var(--text-muted)]">No anomalies flagged right now.</p>
          )}
          {prompts.length > 0 ? (
            <div className="mt-4 border-t border-[var(--border)] pt-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                Growth prompts
              </p>
              <ul className="mt-2 space-y-2">
                {prompts.map((p, i) => (
                  <li key={`${p.title}-${i}`} className="text-sm">
                    {p.href ? (
                      <Link
                        href={p.href}
                        className="font-semibold text-[var(--primary)] hover:underline"
                      >
                        {p.title}
                      </Link>
                    ) : (
                      <span className="font-semibold text-[var(--text)]">{p.title}</span>
                    )}
                    <span className="text-[var(--text-muted)]"> — {p.description}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {data.intelligence?.notes ? (
            <p className="text-xs text-[var(--text-muted)]">{data.intelligence.notes}</p>
          ) : null}
        </CardBody>
      </Card>
    </div>
  );
}
