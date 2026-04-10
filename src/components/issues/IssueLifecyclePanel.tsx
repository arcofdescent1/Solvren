"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardBody } from "@/ui";

type LifecycleEvent = {
  eventType: string;
  fromState: string | null;
  toState: string | null;
  actorType: string;
  createdAt: string;
};

type LifecycleData = {
  issueId: string;
  currentState: string;
  lifecycleVersion: number;
  reopenCount: number;
  terminalReason: string | null;
  closedAt: string | null;
  closedByUserId: string | null;
  events: LifecycleEvent[];
};

const STATE_LABELS: Record<string, string> = {
  DETECTED: "Detected",
  IMPACT_ESTIMATED: "Impact Estimated",
  ACTION_PLANNED: "Action Planned",
  ACTION_EXECUTED: "Action Executed",
  VERIFICATION_PENDING: "Verification Pending",
  VERIFIED_SUCCESS: "Verified Success",
  VERIFIED_FAILURE: "Verified Failure",
  NO_ACTION_TAKEN: "No Action Taken",
  CLOSED: "Closed",
};

export function IssueLifecyclePanel({
  issueId,
  onCloseSuccess,
}: {
  issueId: string;
  onCloseSuccess?: () => void;
}) {
  const [data, setData] = useState<LifecycleData | null>(null);
  const [loading, setLoading] = useState(true);
  const [closeModal, setCloseModal] = useState(false);
  const [noActionModal, setNoActionModal] = useState(false);
  const [closePayload, setClosePayload] = useState({
    classificationType: "resolved_success" as "resolved_success" | "resolved_failure" | "no_action_closed",
    outcomeSummary: "",
  });
  const [noActionPayload, setNoActionPayload] = useState({
    reason: "false_positive" as string,
    notes: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [missingRequirements, setMissingRequirements] = useState<string[]>([]);

  const fetchLifecycle = useCallback(() => {
    setLoading(true);
    fetch(`/api/issues/${issueId}/lifecycle`)
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        if (d?.missingRequirements) setMissingRequirements(d.missingRequirements);
      })
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [issueId]);

  useEffect(() => {
    queueMicrotask(() => {
      fetchLifecycle();
    });
  }, [fetchLifecycle]);

  const canClose = data && ["VERIFIED_SUCCESS", "VERIFIED_FAILURE", "NO_ACTION_TAKEN"].includes(data.currentState);
  const canNoAction = data && ["IMPACT_ESTIMATED", "ACTION_PLANNED"].includes(data.currentState);
  const canReopen = data && data.currentState === "CLOSED";

  const handleClose = async () => {
    if (!data) return;
    setSubmitting(true);
    setError(null);
    const res = await fetch(`/api/issues/${issueId}/close`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        expectedLifecycleVersion: data.lifecycleVersion,
        terminalClassification: {
          classificationType: closePayload.classificationType,
          outcomeSummary: closePayload.outcomeSummary || "Issue closed",
          outcomePayload: {},
        },
      }),
    });
    const json = await res.json();
    setSubmitting(false);
    if (!res.ok) {
      setError(json.error || "Failed to close");
      setMissingRequirements(json.missingRequirements ?? []);
      return;
    }
    setCloseModal(false);
    fetchLifecycle();
    onCloseSuccess?.();
  };

  const handleNoAction = async () => {
    if (!data) return;
    setSubmitting(true);
    setError(null);
    const res = await fetch(`/api/issues/${issueId}/no-action`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        expectedLifecycleVersion: data.lifecycleVersion,
        reason: noActionPayload.reason,
        notes: noActionPayload.notes || undefined,
      }),
    });
    const json = await res.json();
    setSubmitting(false);
    if (!res.ok) {
      setError(json.error || "Failed to record no-action");
      return;
    }
    setNoActionModal(false);
    fetchLifecycle();
    onCloseSuccess?.();
  };

  const handleReopen = async () => {
    if (!data) return;
    setSubmitting(true);
    setError(null);
    const res = await fetch(`/api/issues/${issueId}/reopen`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        expectedLifecycleVersion: data.lifecycleVersion,
        reason: "regression_detected",
        notes: "",
      }),
    });
    const json = await res.json();
    setSubmitting(false);
    if (!res.ok) {
      setError(json.error || "Failed to reopen");
      return;
    }
    fetchLifecycle();
    onCloseSuccess?.();
  };

  if (loading) {
    return (
      <Card>
        <CardBody>
          <h3 className="text-sm font-medium text-[var(--text-muted)] mb-2">Lifecycle</h3>
          <p className="text-sm text-[var(--text-muted)]">Loading…</p>
        </CardBody>
      </Card>
    );
  }

  if (!data) {
    return (
      <Card>
        <CardBody>
          <h3 className="text-sm font-medium text-[var(--text-muted)] mb-2">Lifecycle</h3>
          <p className="text-sm text-[var(--text-muted)]">Could not load lifecycle data.</p>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card>
      <CardBody>
        <h3 className="text-sm font-medium text-[var(--text-muted)] mb-2">Lifecycle</h3>
        <div className="flex items-center gap-2 mb-3">
          <span className="rounded bg-[var(--primary-muted)] px-2 py-0.5 text-sm font-medium text-[var(--primary)]">
            {STATE_LABELS[data.currentState] ?? data.currentState}
          </span>
          {data.reopenCount > 0 && (
            <span className="text-xs text-[var(--text-muted)]">Reopened {data.reopenCount}x</span>
          )}
        </div>

        {missingRequirements.length > 0 && (
          <div className="mb-3 p-2 rounded bg-amber-500/10 border border-amber-500/30">
            <p className="text-xs font-medium text-amber-600 dark:text-amber-400 mb-1">Missing requirements</p>
            <ul className="text-xs text-[var(--text-muted)] list-disc list-inside">
              {missingRequirements.map((m, i) => (
                <li key={i}>{m}</li>
              ))}
            </ul>
          </div>
        )}

        {error && (
          <p className="text-sm text-red-600 dark:text-red-400 mb-2">{error}</p>
        )}

        <div className="flex flex-wrap gap-2 mb-4">
          {canClose && (
            <button
              onClick={() => setCloseModal(true)}
              className="text-sm px-3 py-1.5 rounded bg-[var(--success)] text-white hover:opacity-90"
            >
              Close issue
            </button>
          )}
          {canNoAction && (
            <button
              onClick={() => setNoActionModal(true)}
              className="text-sm px-3 py-1.5 rounded border border-[var(--border)] hover:bg-[var(--bg-muted)]"
            >
              No action
            </button>
          )}
          {canReopen && (
            <button
              onClick={handleReopen}
              disabled={submitting}
              className="text-sm px-3 py-1.5 rounded border border-[var(--border)] hover:bg-[var(--bg-muted)] disabled:opacity-50"
            >
              {submitting ? "Reopening…" : "Reopen"}
            </button>
          )}
        </div>

        <div className="space-y-1.5">
          <p className="text-xs font-medium text-[var(--text-muted)]">Event timeline</p>
          {(data.events ?? []).slice(0, 10).map((e, i) => (
            <div key={i} className="flex items-start gap-2 text-xs">
              <span className="text-[var(--text-muted)] shrink-0">
                {new Date(e.createdAt).toLocaleString()}
              </span>
              <span>
                {e.eventType.replace(/_/g, " ")}
                {e.toState && (
                  <span className="text-[var(--text-muted)]">
                    {" → "}{STATE_LABELS[e.toState] ?? e.toState}
                  </span>
                )}
                <span className="text-[var(--text-muted)]"> ({e.actorType})</span>
              </span>
            </div>
          ))}
        </div>

        {closeModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => !submitting && setCloseModal(false)}>
            <div className="bg-[var(--bg)] rounded-lg shadow-xl p-4 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
              <h4 className="font-medium mb-3">Close issue</h4>
              <div className="space-y-2 mb-4">
                <label className="block text-sm text-[var(--text-muted)]">Classification</label>
                <select
                  value={closePayload.classificationType}
                  onChange={(e) => setClosePayload((p) => ({ ...p, classificationType: e.target.value as typeof p.classificationType }))}
                  className="w-full rounded border border-[var(--border)] bg-[var(--bg)] px-2 py-1.5 text-sm"
                >
                  <option value="resolved_success">Resolved success</option>
                  <option value="resolved_failure">Resolved failure</option>
                  <option value="no_action_closed">No action closed</option>
                </select>
                <label className="block text-sm text-[var(--text-muted)]">Outcome summary</label>
                <textarea
                  value={closePayload.outcomeSummary}
                  onChange={(e) => setClosePayload((p) => ({ ...p, outcomeSummary: e.target.value }))}
                  placeholder="Brief summary of the outcome"
                  className="w-full rounded border border-[var(--border)] bg-[var(--bg)] px-2 py-1.5 text-sm min-h-[60px]"
                />
              </div>
              <div className="flex gap-2 justify-end">
                <button onClick={() => !submitting && setCloseModal(false)} className="px-3 py-1.5 rounded border border-[var(--border)] text-sm">Cancel</button>
                <button onClick={handleClose} disabled={submitting} className="px-3 py-1.5 rounded bg-[var(--success)] text-white text-sm disabled:opacity-50">
                  {submitting ? "Closing…" : "Close"}
                </button>
              </div>
            </div>
          </div>
        )}

        {noActionModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => !submitting && setNoActionModal(false)}>
            <div className="bg-[var(--bg)] rounded-lg shadow-xl p-4 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
              <h4 className="font-medium mb-3">Record no action</h4>
              <div className="space-y-2 mb-4">
                <label className="block text-sm text-[var(--text-muted)]">Reason</label>
                <select
                  value={noActionPayload.reason}
                  onChange={(e) => setNoActionPayload((p) => ({ ...p, reason: e.target.value }))}
                  className="w-full rounded border border-[var(--border)] bg-[var(--bg)] px-2 py-1.5 text-sm"
                >
                  <option value="false_positive">False positive</option>
                  <option value="duplicate_of_existing_issue">Duplicate of existing issue</option>
                  <option value="accepted_business_risk">Accepted business risk</option>
                  <option value="insufficient_permissions">Insufficient permissions</option>
                  <option value="external_blocker_unresolvable">External blocker unresolvable</option>
                  <option value="customer_declined_action">Customer declined action</option>
                  <option value="informational_only">Informational only</option>
                  <option value="test_or_demo_artifact">Test or demo artifact</option>
                </select>
                <label className="block text-sm text-[var(--text-muted)]">Notes</label>
                <textarea
                  value={noActionPayload.notes}
                  onChange={(e) => setNoActionPayload((p) => ({ ...p, notes: e.target.value }))}
                  placeholder="Optional notes"
                  className="w-full rounded border border-[var(--border)] bg-[var(--bg)] px-2 py-1.5 text-sm min-h-[60px]"
                />
              </div>
              <div className="flex gap-2 justify-end">
                <button onClick={() => !submitting && setNoActionModal(false)} className="px-3 py-1.5 rounded border border-[var(--border)] text-sm">Cancel</button>
                <button onClick={handleNoAction} disabled={submitting} className="px-3 py-1.5 rounded bg-[var(--primary)] text-white text-sm disabled:opacity-50">
                  {submitting ? "Submitting…" : "Submit"}
                </button>
              </div>
            </div>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
