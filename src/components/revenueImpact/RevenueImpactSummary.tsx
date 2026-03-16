"use client";

import { useEffect, useState } from "react";
import { Button } from "@/ui";

type SummaryResponse = {
  report: {
    risk: { riskLevel: string; riskScore: number };
    failureModes: Array<{ title: string }>;
    requiredSafeguards: Array<{ title: string }>;
    requiredApprovals: Array<{ role: string }>;
  } | null;
  stale: boolean;
  error?: string;
};

export function RevenueImpactSummary({ changeId }: { changeId: string }) {
  const [state, setState] = useState<SummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  async function load() {
    setLoading(true);
    const res = await fetch(`/api/changes/${changeId}/revenue-impact`);
    const json = (await res.json()) as SummaryResponse;
    setState(json);
    setLoading(false);
  }

  async function regenerate() {
    setGenerating(true);
    await fetch(`/api/changes/${changeId}/revenue-impact/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ regenerate: true }),
    });
    await load();
    setGenerating(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [changeId]);

  if (loading) return <div className="text-sm text-[var(--text-muted)]">Loading report summary...</div>;

  if (!state?.report) {
    return (
      <div className="rounded border border-[var(--border)] p-3">
        <div className="text-sm text-[var(--text-muted)]">No Revenue Impact Report generated yet.</div>
        <Button type="button" onClick={regenerate} disabled={generating} className="mt-2">
          {generating ? "Generating..." : "Generate Report"}
        </Button>
      </div>
    );
  }

  return (
    <div className="rounded border border-[var(--border)] p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm font-semibold">Revenue Impact Report</div>
        <div className="text-xs">
          {state.report.risk.riskLevel} • {state.report.risk.riskScore}/100
        </div>
      </div>
      {state.stale ? (
        <div className="text-xs text-yellow-700">
          This report may be outdated because the change was modified after generation.
        </div>
      ) : null}
      <div className="text-sm">
        <strong>Top failure modes:</strong>{" "}
        {state.report.failureModes.slice(0, 3).map((f) => f.title).join(", ") || "—"}
      </div>
      <div className="text-sm">
        <strong>Top safeguards:</strong>{" "}
        {state.report.requiredSafeguards.slice(0, 3).map((s) => s.title).join(", ") || "—"}
      </div>
      <div className="text-sm">
        <strong>Required approvals:</strong>{" "}
        {state.report.requiredApprovals.map((a) => a.role).join(", ") || "—"}
      </div>
      <Button type="button" onClick={regenerate} disabled={generating}>
        {generating ? "Regenerating..." : "Regenerate"}
      </Button>
    </div>
  );
}
