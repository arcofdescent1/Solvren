"use client";

import { Card, CardBody } from "@/ui";

type Run = {
  id: string;
  status: string;
  simulation_type: string;
  result_summary_json: unknown;
  confidence_summary_json: unknown;
  warning_summary_json: unknown;
  created_at: string;
  completed_at: string | null;
  config_json: Record<string, unknown>;
};

type Step = {
  sequence_no: number;
  step_key: string;
  step_type: string;
  step_status: string;
  issue_id: string | null;
};

type EntityResult = {
  issue_id: string | null;
  projected_recovered_amount: number | null;
  projected_avoided_amount: number | null;
  action_count: number;
  approval_count: number;
  blocked_action_count: number;
  confidence_score: number;
  confidence_band: string;
};

export function SimulationDetailClient({
  runId,
  run,
  summary,
  confidence,
  warnings,
  steps,
  entityResults,
}: {
  runId: string;
  run: Run;
  summary: Record<string, unknown> | null;
  confidence: Record<string, unknown> | null;
  warnings: string[];
  steps: Step[];
  entityResults: EntityResult[];
}) {
  const fmt = (n: number) => new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardBody>
          <h3 className="text-sm font-medium text-[var(--text-muted)] mb-2">Summary</h3>
          <dl className="space-y-1 text-sm">
            <div className="flex justify-between">
              <dt>Status</dt>
              <dd className="font-medium">{run.status}</dd>
            </div>
            {summary && (summary.projectedRecoveredAmount as number) != null && (
              <>
                <div className="flex justify-between">
                  <dt>Projected recovered</dt>
                  <dd>{fmt(summary.projectedRecoveredAmount as number)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt>Projected avoided</dt>
                  <dd>{fmt(summary.projectedAvoidedAmount as number)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt>Affected issues</dt>
                  <dd>{summary.affectedIssueCount as number}</dd>
                </div>
                <div className="flex justify-between">
                  <dt>Simulated actions</dt>
                  <dd>{summary.simulatedActionCount as number}</dd>
                </div>
                <div className="flex justify-between">
                  <dt>Approvals required</dt>
                  <dd>{summary.approvalRequiredCount as number}</dd>
                </div>
                <div className="flex justify-between">
                  <dt>Blocked actions</dt>
                  <dd>{summary.blockedActionCount as number}</dd>
                </div>
              </>
            )}
          </dl>
        </CardBody>
      </Card>
      <Card>
        <CardBody>
          <h3 className="text-sm font-medium text-[var(--text-muted)] mb-2">Confidence</h3>
          {confidence ? (
            <dl className="space-y-1 text-sm">
              <div className="flex justify-between">
                <dt>Score</dt>
                <dd className="font-medium">{(confidence.score as number) ?? 0}%</dd>
              </div>
              <div className="flex justify-between">
                <dt>Band</dt>
                <dd>{(confidence.band as string) ?? "—"}</dd>
              </div>
              {(confidence.reasons as string[])?.length > 0 && (
                <div>
                  <dt className="mb-1">Reasons</dt>
                  <dd className="text-xs text-[var(--text-muted)]">
                    {(confidence.reasons as string[]).map((r, i) => (
                      <div key={i}>{r}</div>
                    ))}
                  </dd>
                </div>
              )}
            </dl>
          ) : (
            <p className="text-sm text-[var(--text-muted)]">Not yet computed</p>
          )}
        </CardBody>
      </Card>
      {warnings.length > 0 && (
        <Card className="md:col-span-2">
          <CardBody>
            <h3 className="text-sm font-medium text-amber-600 dark:text-amber-400 mb-2">Warnings</h3>
            <ul className="list-disc list-inside text-sm text-[var(--text-muted)]">
              {warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          </CardBody>
        </Card>
      )}
      <Card className="md:col-span-2">
        <CardBody>
          <h3 className="text-sm font-medium text-[var(--text-muted)] mb-2">Step timeline</h3>
          {steps.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)]">No step results yet</p>
          ) : (
            <div className="space-y-1 max-h-64 overflow-y-auto">
              {steps.map((s, i) => (
                <div key={i} className="flex items-center gap-4 text-xs">
                  <span className="w-6 shrink-0 text-[var(--text-muted)]">{s.sequence_no}</span>
                  <span className="font-mono">{s.step_key}</span>
                  <span className="rounded px-1.5 py-0.5 bg-[var(--bg-muted)]">{s.step_status}</span>
                  <span className="text-[var(--text-muted)]">{s.step_type}</span>
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>
      {entityResults.length > 0 && (
        <Card className="md:col-span-2">
          <CardBody>
            <h3 className="text-sm font-medium text-[var(--text-muted)] mb-2">Per-entity results</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)]">
                    <th className="text-left py-2">Issue</th>
                    <th className="text-right py-2">Recovered</th>
                    <th className="text-right py-2">Avoided</th>
                    <th className="text-right py-2">Actions</th>
                    <th className="text-right py-2">Approvals</th>
                    <th className="text-right py-2">Confidence</th>
                  </tr>
                </thead>
                <tbody>
                  {entityResults.slice(0, 20).map((e, i) => (
                    <tr key={i} className="border-b border-[var(--border)]">
                      <td className="py-1.5 font-mono text-xs">{e.issue_id?.slice(0, 8) ?? "—"}</td>
                      <td className="text-right">{e.projected_recovered_amount != null ? fmt(e.projected_recovered_amount) : "—"}</td>
                      <td className="text-right">{e.projected_avoided_amount != null ? fmt(e.projected_avoided_amount) : "—"}</td>
                      <td className="text-right">{e.action_count}</td>
                      <td className="text-right">{e.approval_count}</td>
                      <td className="text-right">{e.confidence_band} ({e.confidence_score})</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
