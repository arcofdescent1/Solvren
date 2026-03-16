"use client";

import { useEffect, useState } from "react";
import { Button } from "@/ui";
import { FailureModesList } from "./FailureModesList";
import { SafeguardsList } from "./SafeguardsList";
import { HistoricalSignalsList } from "./HistoricalSignalsList";

type RevenueImpactReport = {
  summary: { businessSummary: string; technicalSummary: string };
  risk: { riskLevel: string; riskScore: number; confidenceScore: number };
  impact: {
    revenueImpactAreas: string[];
    customerImpactLevel: string;
    estimatedExposureBand: string;
    reportingImpact: boolean;
    operationalImpact: boolean;
  };
  systems: {
    primarySystems: string[];
    secondarySystems: string[];
    integrationComplexity: string;
  };
  failureModes: Array<{
    title: string;
    description: string;
    severity: string;
    likelihood: string;
    signals: string[];
  }>;
  historicalSignals: Array<{ signalKey: string; description: string; strength: string }>;
  requiredSafeguards: Array<{ code: string; title: string; reason: string }>;
  recommendedSafeguards: Array<{ code: string; title: string; reason: string }>;
  requiredApprovals: Array<{ role: string; reason: string }>;
  executiveSummary: {
    whyThisMatters: string;
    worstReasonableOutcome: string;
    whatReducesRiskMost: string;
  };
};

type ApiState = {
  report: RevenueImpactReport | null;
  stale: boolean;
  generated_at?: string;
  generated_by?: string;
  version?: number;
  risk_score?: number;
  risk_level?: string;
  confidence_score?: number;
};

export function RevenueImpactCard({ changeId }: { changeId: string }) {
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ApiState | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/changes/${changeId}/revenue-impact`);
      const json = (await res.json()) as ApiState & { error?: string };
      if (!res.ok) throw new Error(json.error ?? "Failed to load report");
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load report");
    } finally {
      setLoading(false);
    }
  }

  async function generate(regenerate: boolean) {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch(`/api/changes/${changeId}/revenue-impact/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ regenerate }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? "Generation failed");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Generation failed");
    } finally {
      setGenerating(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [changeId]);

  const report = data?.report ?? null;

  return (
    <div className="rounded border border-[var(--border)] bg-[var(--bg)] p-4 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Revenue Impact Report</h2>
          <div className="text-xs text-[var(--text-muted)]">
            Structured executive risk memo for this change.
          </div>
        </div>
        <Button
          type="button"
          disabled={generating}
          onClick={() => generate(Boolean(report))}
        >
          {generating ? "Generating..." : report ? "Regenerate" : "Generate Report"}
        </Button>
      </div>

      {loading ? <div className="text-sm text-[var(--text-muted)]">Loading...</div> : null}
      {error ? <div className="text-sm text-[var(--danger)]">{error}</div> : null}
      {!loading && !error && !report ? (
        <div className="text-sm text-[var(--text-muted)]">No Revenue Impact Report generated yet.</div>
      ) : null}

      {!loading && report ? (
        <div className="space-y-4">
          <div className="rounded border border-[var(--border)] p-3">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="font-semibold">{report.risk.riskLevel}</span>
              <span>{report.risk.riskScore}/100</span>
              <span>{report.risk.confidenceScore}% confidence</span>
              {data?.stale ? (
                <span className="rounded border border-yellow-600 px-2 py-0.5 text-xs">
                  stale
                </span>
              ) : null}
              {data?.generated_by === "RULES_ONLY" ? (
                <span className="rounded border px-2 py-0.5 text-xs">Generated using baseline risk rules</span>
              ) : null}
            </div>
            <div className="mt-2 text-xs text-[var(--text-muted)]">
              {data?.generated_at ? new Date(data.generated_at).toLocaleString() : "—"}
            </div>
          </div>

          <div className="rounded border border-[var(--border)] p-3">
            <div className="text-sm font-semibold">Executive Summary</div>
            <div className="mt-2 text-sm">
              <div><strong>Why this matters:</strong> {report.executiveSummary.whyThisMatters}</div>
              <div><strong>Worst reasonable outcome:</strong> {report.executiveSummary.worstReasonableOutcome}</div>
              <div><strong>What reduces risk most:</strong> {report.executiveSummary.whatReducesRiskMost}</div>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded border border-[var(--border)] p-3">
              <div className="text-sm font-semibold">Business Summary</div>
              <div className="text-sm">{report.summary.businessSummary}</div>
            </div>
            <div className="rounded border border-[var(--border)] p-3">
              <div className="text-sm font-semibold">Technical Summary</div>
              <div className="text-sm">{report.summary.technicalSummary}</div>
            </div>
          </div>

          <div className="rounded border border-[var(--border)] p-3 text-sm">
            <div className="font-semibold">Impact Overview</div>
            <div>Areas: {report.impact.revenueImpactAreas.join(", ") || "—"}</div>
            <div>Customer impact: {report.impact.customerImpactLevel}</div>
            <div>Exposure band: {report.impact.estimatedExposureBand}</div>
            <div>Reporting impact: {report.impact.reportingImpact ? "Yes" : "No"}</div>
            <div>Operational impact: {report.impact.operationalImpact ? "Yes" : "No"}</div>
          </div>

          <div className="rounded border border-[var(--border)] p-3 text-sm">
            <div className="font-semibold">Systems</div>
            <div>Primary: {report.systems.primarySystems.join(", ") || "—"}</div>
            <div>Secondary: {report.systems.secondarySystems.join(", ") || "—"}</div>
            <div>Integration complexity: {report.systems.integrationComplexity}</div>
          </div>

          <div>
            <div className="mb-2 text-sm font-semibold">Likely Failure Modes</div>
            <FailureModesList items={report.failureModes} />
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <SafeguardsList title="Required Safeguards" items={report.requiredSafeguards} />
            <SafeguardsList title="Recommended Safeguards" items={report.recommendedSafeguards} />
          </div>

          <div className="rounded border border-[var(--border)] p-3">
            <div className="text-sm font-semibold">Required Approvals</div>
            {report.requiredApprovals.length === 0 ? (
              <div className="text-sm text-[var(--text-muted)]">None</div>
            ) : (
              <ul className="mt-2 space-y-1">
                {report.requiredApprovals.map((a, i) => (
                  <li key={`${a.role}-${i}`} className="text-sm">
                    <span className="font-medium">{a.role}</span> — {a.reason}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <HistoricalSignalsList items={report.historicalSignals} />
        </div>
      ) : null}
    </div>
  );
}
