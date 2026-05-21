"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge, Button, Card, CardBody, CardDescription, CardHeader, CardTitle } from "@/ui";

export default function ReportSuggestionsPanel(props: { changeId: string }) {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [s, setS] = useState<{
    reportVersion?: number;
    reportCreatedAt?: string;
    suggestedApprovalAreas?: string[];
    suggestedEvidenceItems?: string[];
    requiredApprovalsRaw?: string[];
  } | null>(null);
  const [applyA, setApplyA] = useState(false);
  const [applyE, setApplyE] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch(`/api/changes/${props.changeId}/report-suggestions`);
      const json = await res.json();
      if (!res.ok) throw new Error((json as { error?: string }).error || "Failed");
      setS((json as { suggestions?: typeof s }).suggestions ?? null);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  }, [props.changeId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function applyApprovals() {
    setApplyA(true);
    setToast(null);
    try {
      const res = await fetch(`/api/changes/${props.changeId}/apply-approval-suggestions`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error((json as { error?: string }).error || "Failed");
      setToast("Decision owners queued.");
      window.dispatchEvent(new CustomEvent("approvals:queued"));
      document.getElementById("approvals")?.scrollIntoView({ behavior: "smooth" });
    } catch (e: unknown) {
      setToast(e instanceof Error ? e.message : "Failed");
    } finally {
      setApplyA(false);
    }
  }

  async function applyEvidence() {
    setApplyE(true);
    setToast(null);
    try {
      const res = await fetch(`/api/changes/${props.changeId}/apply-evidence-suggestions`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error((json as { error?: string }).error || "Failed");
      setToast(`Added ${(json as { applied?: number }).applied ?? 0} proof item(s).`);
      window.dispatchEvent(new CustomEvent("evidence:refresh"));
    } catch (e: unknown) {
      setToast(e instanceof Error ? e.message : "Failed");
    } finally {
      setApplyE(false);
    }
  }

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-4">
        <div>
          <CardTitle>Apply report recommendations</CardTitle>
          <CardDescription>Use the revenue impact report to fill in decision owners and proof requirements.</CardDescription>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" onClick={applyApprovals} disabled={applyA || loading || !s}>
            {applyA ? "Applying..." : "Add owners"}
          </Button>
          <Button type="button" onClick={applyEvidence} disabled={applyE || loading || !s}>
            {applyE ? "Adding..." : "Add proof"}
          </Button>
        </div>
      </CardHeader>
      <CardBody className="space-y-4">
        {toast ? <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-surface-2)] p-3 text-sm">{toast}</div> : null}
        {loading ? <p className="text-sm text-[var(--text-muted)]">Loading recommendations...</p> : null}
        {err ? <p className="text-sm text-[var(--danger)]">Error: {err}</p> : null}
        {!loading && !err && !s ? (
          <div className="rounded-[var(--radius-md)] border border-dashed border-[var(--border)] bg-[var(--bg-surface-2)] p-4 text-sm text-[var(--text-muted)]">
            Generate a revenue impact report to see recommendations.
          </div>
        ) : null}
        {s ? (
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-surface-2)] p-3">
              <div className="text-sm font-semibold">Suggested decision owners</div>
              <div className="mt-3 flex flex-wrap gap-2">
                {(s.suggestedApprovalAreas ?? []).length ? (
                  (s.suggestedApprovalAreas ?? []).map((a) => <Badge key={a} variant="secondary">{a}</Badge>)
                ) : (
                  <div className="text-sm text-[var(--text-muted)]">No mapped decision owners.</div>
                )}
              </div>
            </div>
            <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-surface-2)] p-3">
              <div className="text-sm font-semibold">Suggested proof checklist</div>
              {(s.suggestedEvidenceItems ?? []).length ? (
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-[var(--text-muted)]">
                  {(s.suggestedEvidenceItems ?? []).slice(0, 8).map((e, i) => <li key={i}>{e}</li>)}
                </ul>
              ) : (
                <div className="mt-2 text-sm text-[var(--text-muted)]">No proof suggestions.</div>
              )}
            </div>
          </div>
        ) : null}
      </CardBody>
    </Card>
  );
}
