"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardBody } from "@/ui";

type RunOption = {
  id: string;
  status: string;
  simulation_type: string;
  created_at: string;
  result_summary_json: Record<string, unknown> | null;
  confidence_summary_json: Record<string, unknown> | null;
};

type ComparisonResult = {
  baselineRunId: string;
  candidateRunId: string;
  deltas: {
    projectedRecoveredAmount: number;
    projectedAvoidedAmount: number;
    projectedOperationalSavingsAmount: number;
    affectedIssueCount: number;
    simulatedActionCount: number;
    approvalRequiredCount: number;
    blockedActionCount: number;
  };
  summary: string;
};

export function SimulationCompareClient({
  orgId: _orgId,
  runs,
  initialBaselineId,
  initialCandidateId,
}: {
  orgId: string;
  runs: RunOption[];
  initialBaselineId?: string | null;
  initialCandidateId?: string | null;
}) {
  const [baselineId, setBaselineId] = useState(initialBaselineId ?? "");
  const [candidateId, setCandidateId] = useState(initialCandidateId ?? "");
  const [comparison, setComparison] = useState<ComparisonResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchComparison = useCallback(async () => {
    if (!baselineId || !candidateId || baselineId === candidateId) {
      setError("Select different baseline and candidate runs");
      return;
    }
    setLoading(true);
    setError(null);
    setComparison(null);
    try {
      const res = await fetch("/api/admin/simulations/compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ baselineRunId: baselineId, candidateRunId: candidateId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error ?? "Comparison failed");
        return;
      }
      setComparison(data);
    } finally {
      setLoading(false);
    }
  }, [baselineId, candidateId]);

  useEffect(() => {
    if (!initialBaselineId || !initialCandidateId || initialBaselineId === initialCandidateId) return;
    setBaselineId(initialBaselineId);
    setCandidateId(initialCandidateId);
    setComparison(null);
    setLoading(true);
    setError(null);
    fetch("/api/admin/simulations/compare", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        baselineRunId: initialBaselineId,
        candidateRunId: initialCandidateId,
      }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data?.baselineRunId) setComparison(data);
        else setError(data?.error ?? "Comparison failed");
      })
      .catch(() => setError("Request failed"))
      .finally(() => setLoading(false));
  }, [initialBaselineId, initialCandidateId]);

  const fmt = (n: number) =>
    new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(n);

  const deltaFmt = (d: number) => {
    const s = d >= 0 ? "+" : "";
    return `${s}${fmt(d)}`;
  };

  const completedRuns = runs.filter((r) => r.status === "COMPLETED");

  return (
    <div className="space-y-6">
      <Card>
        <CardBody>
          <h3 className="text-sm font-medium text-[var(--text-muted)] mb-3">Select runs to compare</h3>
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <label className="block text-xs text-[var(--text-muted)] mb-1">Baseline</label>
              <select
                value={baselineId}
                onChange={(e) => setBaselineId(e.target.value)}
                className="rounded border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm min-w-[200px]"
              >
                <option value="">— Select —</option>
                {completedRuns.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.id.slice(0, 8)} — {r.simulation_type} — {new Date(r.created_at).toLocaleDateString()}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-[var(--text-muted)] mb-1">Candidate</label>
              <select
                value={candidateId}
                onChange={(e) => setCandidateId(e.target.value)}
                className="rounded border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm min-w-[200px]"
              >
                <option value="">— Select —</option>
                {completedRuns.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.id.slice(0, 8)} — {r.simulation_type} — {new Date(r.created_at).toLocaleDateString()}
                  </option>
                ))}
              </select>
            </div>
            <button
              onClick={fetchComparison}
              disabled={loading || !baselineId || !candidateId || baselineId === candidateId}
              className="rounded bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {loading ? "Comparing…" : "Compare"}
            </button>
          </div>
          {error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}
        </CardBody>
      </Card>

      {comparison && (
        <>
          <Card>
            <CardBody>
              <h3 className="text-sm font-medium text-[var(--text-muted)] mb-3">Delta summary</h3>
              <p className="text-sm mb-4">{comparison.summary}</p>
              <dl className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                <div>
                  <dt className="text-[var(--text-muted)]">Projected recovered</dt>
                  <dd className="font-medium">{deltaFmt(comparison.deltas.projectedRecoveredAmount)}</dd>
                </div>
                <div>
                  <dt className="text-[var(--text-muted)]">Projected avoided</dt>
                  <dd className="font-medium">{deltaFmt(comparison.deltas.projectedAvoidedAmount)}</dd>
                </div>
                <div>
                  <dt className="text-[var(--text-muted)]">Approvals required</dt>
                  <dd className="font-medium">
                    {comparison.deltas.approvalRequiredCount >= 0 ? "+" : ""}
                    {comparison.deltas.approvalRequiredCount}
                  </dd>
                </div>
                <div>
                  <dt className="text-[var(--text-muted)]">Blocked actions</dt>
                  <dd className="font-medium">
                    {comparison.deltas.blockedActionCount >= 0 ? "+" : ""}
                    {comparison.deltas.blockedActionCount}
                  </dd>
                </div>
                <div>
                  <dt className="text-[var(--text-muted)]">Affected issues</dt>
                  <dd className="font-medium">
                    {comparison.deltas.affectedIssueCount >= 0 ? "+" : ""}
                    {comparison.deltas.affectedIssueCount}
                  </dd>
                </div>
                <div>
                  <dt className="text-[var(--text-muted)]">Simulated actions</dt>
                  <dd className="font-medium">
                    {comparison.deltas.simulatedActionCount >= 0 ? "+" : ""}
                    {comparison.deltas.simulatedActionCount}
                  </dd>
                </div>
              </dl>
            </CardBody>
          </Card>

          <div className="grid md:grid-cols-2 gap-4">
            <Card>
              <CardBody>
                <h3 className="text-sm font-medium text-[var(--text-muted)] mb-2">Baseline</h3>
                <Link
                  href={`/admin/simulation/${comparison.baselineRunId}`}
                  className="text-sm font-mono text-[var(--primary)] hover:underline"
                >
                  {comparison.baselineRunId.slice(0, 8)}…
                </Link>
              </CardBody>
            </Card>
            <Card>
              <CardBody>
                <h3 className="text-sm font-medium text-[var(--text-muted)] mb-2">Candidate</h3>
                <Link
                  href={`/admin/simulation/${comparison.candidateRunId}`}
                  className="text-sm font-mono text-[var(--primary)] hover:underline"
                >
                  {comparison.candidateRunId.slice(0, 8)}…
                </Link>
              </CardBody>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
