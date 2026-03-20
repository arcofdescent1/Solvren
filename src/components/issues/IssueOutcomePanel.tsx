"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardBody } from "@/ui";

type OutcomeRow = {
  id: string;
  outcome_type: string;
  amount: number;
  verification_type: string;
  confidence_score: number;
  created_at: string;
};

type SummaryRow = {
  total_recovered: number;
  total_avoided: number;
  total_cost_savings: number;
  outcome_count: number;
};

export function IssueOutcomePanel({ issueId }: { issueId: string }) {
  const [outcomes, setOutcomes] = useState<OutcomeRow[]>([]);
  const [summary, setSummary] = useState<SummaryRow | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/issues/${issueId}/outcomes`)
      .then((r) => r.json())
      .then((d) => {
        setOutcomes(d.outcomes ?? []);
        setSummary(d.summary ?? null);
      })
      .finally(() => setLoading(false));
  }, [issueId]);

  const fmt = (n: number) => new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
  const total = (summary?.total_recovered ?? 0) + (summary?.total_avoided ?? 0) + (summary?.total_cost_savings ?? 0);

  if (loading) {
    return (
      <Card>
        <CardBody>
          <h3 className="text-sm font-medium text-[var(--text-muted)] mb-2">Verified outcomes</h3>
          <p className="text-sm text-[var(--text-muted)]">Loading…</p>
        </CardBody>
      </Card>
    );
  }

  if (outcomes.length === 0) {
    return (
      <Card>
        <CardBody>
          <h3 className="text-sm font-medium text-[var(--text-muted)] mb-2">Verified outcomes</h3>
          <p className="text-sm text-[var(--text-muted)]">No outcomes yet. Outcomes are recorded when actions succeed.</p>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card>
      <CardBody>
        <h3 className="text-sm font-medium text-[var(--text-muted)] mb-2">Verified outcomes</h3>
        {total > 0 && (
          <p className="text-lg font-semibold text-[var(--success)] mb-2">{fmt(total)} total value</p>
        )}
        <ul className="space-y-1.5 text-sm">
          {outcomes.map((o) => (
            <li key={o.id} className="flex items-center justify-between gap-2">
              <span className="text-[var(--text-muted)]">
                {o.outcome_type.replace(/_/g, " ")} ({o.verification_type})
              </span>
              <span className="font-medium">{fmt(o.amount)}</span>
            </li>
          ))}
        </ul>
        <Link href="/executive/roi" className="text-xs text-[var(--primary)] hover:underline mt-2 inline-block">
          View ROI Dashboard →
        </Link>
      </CardBody>
    </Card>
  );
}
