"use client";

/**
 * Phase 2 — Match candidate review panel (§13). Accept existing / Create new / Reject.
 */
import * as React from "react";

export type MatchCandidateReviewPanelProps = {
  candidateId: string;
  orgId: string;
  proposedCanonicalEntityId: string | null;
  primaryProvider: string;
  primaryObjectType: string;
  primaryExternalId: string;
  confidenceScore: number;
  onSuccess?: () => void;
};

export function MatchCandidateReviewPanel({
  candidateId,
  orgId,
  proposedCanonicalEntityId,
  primaryProvider,
  primaryObjectType,
  primaryExternalId,
  confidenceScore,
  onSuccess,
}: MatchCandidateReviewPanelProps) {
  const [decision, setDecision] = React.useState<"accept_existing" | "create_new" | "reject" | null>(null);
  const [notes, setNotes] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const submit = async () => {
    if (!decision) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/identity/match-candidates/${candidateId}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          decision,
          canonicalEntityId: decision === "accept_existing" ? proposedCanonicalEntityId : undefined,
          notes: notes || undefined,
        }),
      });
      const data = await res.json();
      if (!data.ok) {
        setError(data.error?.message ?? "Review failed");
        return;
      }
      onSuccess?.();
      window.location.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-muted)] p-4">
      <h4 className="text-sm font-semibold text-[var(--text)]">Review match candidate</h4>
      <p className="mt-1 text-sm text-[var(--text-muted)]">
        {primaryProvider} / {primaryObjectType} — {primaryExternalId} ({(Number(confidenceScore) * 100).toFixed(0)}%)
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {proposedCanonicalEntityId && (
          <button
            type="button"
            onClick={() => setDecision("accept_existing")}
            className={`rounded px-3 py-1.5 text-sm font-medium ${decision === "accept_existing" ? "bg-[var(--primary)] text-white" : "bg-[var(--bg-surface)] text-[var(--text)] hover:bg-[var(--border)]"}`}
          >
            Accept existing entity
          </button>
        )}
        <button
          type="button"
          onClick={() => setDecision("create_new")}
          className={`rounded px-3 py-1.5 text-sm font-medium ${decision === "create_new" ? "bg-[var(--primary)] text-white" : "bg-[var(--bg-surface)] text-[var(--text)] hover:bg-[var(--border)]"}`}
        >
          Create new entity
        </button>
        <button
          type="button"
          onClick={() => setDecision("reject")}
          className={`rounded px-3 py-1.5 text-sm font-medium ${decision === "reject" ? "bg-red-600 text-white" : "bg-[var(--bg-surface)] text-[var(--text)] hover:bg-[var(--border)]"}`}
        >
          Reject
        </button>
      </div>
      <div className="mt-3">
        <label className="block text-xs font-medium text-[var(--text-muted)]">Notes (optional)</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="mt-1 w-full rounded border border-[var(--border)] bg-[var(--bg-surface)] px-2 py-1.5 text-sm"
          rows={2}
        />
      </div>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      <div className="mt-3">
        <button
          type="button"
          onClick={submit}
          disabled={!decision || submitting}
          className="rounded bg-[var(--primary)] px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
        >
          {submitting ? "Submitting…" : "Submit"}
        </button>
      </div>
    </div>
  );
}
