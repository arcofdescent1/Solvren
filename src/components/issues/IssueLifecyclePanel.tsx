"use client";

import { useCallback, useEffect, useState } from "react";
import { Button, Card, CardBody, NativeSelect, Textarea } from "@/ui";

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
  IMPACT_ESTIMATED: "Impact estimated",
  ACTION_PLANNED: "Action planned",
  ACTION_EXECUTED: "Action taken",
  VERIFICATION_PENDING: "Checking result",
  VERIFIED_SUCCESS: "Solved",
  VERIFIED_FAILURE: "Still needs work",
  NO_ACTION_TAKEN: "No action taken",
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
          outcomeSummary: closePayload.outcomeSummary || "Problem closed",
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
      setError(json.error || "Failed to record no action");
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
          <h3 className="mb-2 text-sm font-medium text-[var(--text-muted)]">Problem status</h3>
          <p className="text-sm text-[var(--text-muted)]">Loading...</p>
        </CardBody>
      </Card>
    );
  }

  if (!data) {
    return (
      <Card>
        <CardBody>
          <h3 className="mb-2 text-sm font-medium text-[var(--text-muted)]">Problem status</h3>
          <p className="text-sm text-[var(--text-muted)]">Could not load status data.</p>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card>
      <CardBody className="space-y-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Problem status</p>
          <h3 className="mt-1 text-lg font-semibold text-[var(--text)]">Where this stands now</h3>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-[var(--radius-md)] bg-[var(--primary-muted)] px-2.5 py-1 text-sm font-semibold text-[var(--primary)]">
            {STATE_LABELS[data.currentState] ?? data.currentState}
          </span>
          {data.reopenCount > 0 ? (
            <span className="text-xs text-[var(--text-muted)]">Reopened {data.reopenCount}x</span>
          ) : null}
        </div>

        {missingRequirements.length > 0 ? (
          <div className="rounded-[var(--radius-lg)] border border-amber-500/30 bg-amber-500/10 p-3">
            <p className="mb-1 text-xs font-semibold text-amber-700 dark:text-amber-300">
              Needed before this can be closed
            </p>
            <ul className="list-inside list-disc text-xs text-[var(--text-muted)]">
              {missingRequirements.map((requirement) => (
                <li key={requirement}>{requirement}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {error ? (
          <p className="rounded-[var(--radius-md)] border border-[var(--danger)]/30 bg-[var(--danger)]/10 px-3 py-2 text-sm text-[var(--danger)]">
            {error}
          </p>
        ) : null}

        <div className="flex flex-wrap gap-2">
          {canClose ? (
            <Button onClick={() => setCloseModal(true)} className="bg-[var(--success)] hover:brightness-95">
              Close problem
            </Button>
          ) : null}
          {canNoAction ? (
            <Button variant="secondary" onClick={() => setNoActionModal(true)}>
              No action
            </Button>
          ) : null}
          {canReopen ? (
            <Button variant="secondary" onClick={handleReopen} disabled={submitting}>
              {submitting ? "Reopening..." : "Reopen"}
            </Button>
          ) : null}
        </div>

        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Recent activity</p>
          {(data.events ?? []).slice(0, 10).map((event, index) => (
            <div
              key={`${event.createdAt}-${index}`}
              className="flex items-start gap-3 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-surface-2)] px-3 py-2 text-xs"
            >
              <span className="shrink-0 text-[var(--text-muted)]">{new Date(event.createdAt).toLocaleString()}</span>
              <span>
                {event.eventType.replace(/_/g, " ")}
                {event.toState ? (
                  <span className="text-[var(--text-muted)]"> {" -> "}{STATE_LABELS[event.toState] ?? event.toState}</span>
                ) : null}
                <span className="text-[var(--text-muted)]"> ({event.actorType})</span>
              </span>
            </div>
          ))}
        </div>

        {closeModal ? (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
            onClick={() => !submitting && setCloseModal(false)}
          >
            <div
              className="w-full max-w-md rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--bg-surface)] p-5 shadow-[var(--shadow-lg)]"
              onClick={(event) => event.stopPropagation()}
            >
              <h4 className="mb-3 text-lg font-semibold">Close problem</h4>
              <div className="mb-4 space-y-2">
                <label className="block text-sm text-[var(--text-muted)]">Classification</label>
                <NativeSelect
                  value={closePayload.classificationType}
                  onChange={(event) =>
                    setClosePayload((payload) => ({
                      ...payload,
                      classificationType: event.target.value as typeof payload.classificationType,
                    }))
                  }
                  className="w-full"
                >
                  <option value="resolved_success">Solved</option>
                  <option value="resolved_failure">Still needs work</option>
                  <option value="no_action_closed">No action needed</option>
                </NativeSelect>
                <label className="block text-sm text-[var(--text-muted)]">Outcome summary</label>
                <Textarea
                  value={closePayload.outcomeSummary}
                  onChange={(event) => setClosePayload((payload) => ({ ...payload, outcomeSummary: event.target.value }))}
                  placeholder="Brief summary of what happened"
                  className="min-h-[80px]"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="secondary" onClick={() => !submitting && setCloseModal(false)}>
                  Cancel
                </Button>
                <Button onClick={handleClose} disabled={submitting} className="bg-[var(--success)] hover:brightness-95">
                  {submitting ? "Closing..." : "Close"}
                </Button>
              </div>
            </div>
          </div>
        ) : null}

        {noActionModal ? (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
            onClick={() => !submitting && setNoActionModal(false)}
          >
            <div
              className="w-full max-w-md rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--bg-surface)] p-5 shadow-[var(--shadow-lg)]"
              onClick={(event) => event.stopPropagation()}
            >
              <h4 className="mb-3 text-lg font-semibold">Record no action</h4>
              <div className="mb-4 space-y-2">
                <label className="block text-sm text-[var(--text-muted)]">Reason</label>
                <NativeSelect
                  value={noActionPayload.reason}
                  onChange={(event) => setNoActionPayload((payload) => ({ ...payload, reason: event.target.value }))}
                  className="w-full"
                >
                  <option value="false_positive">False positive</option>
                  <option value="duplicate_of_existing_issue">Duplicate of existing problem</option>
                  <option value="accepted_business_risk">Accepted business risk</option>
                  <option value="insufficient_permissions">Missing access</option>
                  <option value="external_blocker_unresolvable">External blocker</option>
                  <option value="customer_declined_action">Customer declined action</option>
                  <option value="informational_only">Informational only</option>
                  <option value="test_or_demo_artifact">Test or demo data</option>
                </NativeSelect>
                <label className="block text-sm text-[var(--text-muted)]">Notes</label>
                <Textarea
                  value={noActionPayload.notes}
                  onChange={(event) => setNoActionPayload((payload) => ({ ...payload, notes: event.target.value }))}
                  placeholder="Optional notes"
                  className="min-h-[80px]"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="secondary" onClick={() => !submitting && setNoActionModal(false)}>
                  Cancel
                </Button>
                <Button onClick={handleNoAction} disabled={submitting}>
                  {submitting ? "Submitting..." : "Submit"}
                </Button>
              </div>
            </div>
          </div>
        ) : null}
      </CardBody>
    </Card>
  );
}
