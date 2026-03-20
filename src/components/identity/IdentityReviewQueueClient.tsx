"use client";

/**
 * Phase 2 — Identity Review Queue UI (§15.1). Pending candidates table + review actions.
 */
import * as React from "react";

export type MatchCandidateItem = {
  id: string;
  candidate_type: string;
  primary_provider: string;
  primary_object_type: string;
  primary_external_id: string;
  proposed_entity_type: string;
  proposed_canonical_entity_id: string | null;
  confidence_score: number;
  reasons_json: string[];
  review_status: string;
  created_at: string;
};

export function IdentityReviewQueueClient({
  orgId,
  initialCandidates,
}: {
  orgId: string;
  initialCandidates: MatchCandidateItem[];
}) {
  const [candidates, setCandidates] = React.useState(initialCandidates);
  const [loading, setLoading] = React.useState(false);

  const refresh = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/identity/match-candidates?orgId=${encodeURIComponent(orgId)}&reviewStatus=pending`);
      const data = await res.json();
      if (data.ok && Array.isArray(data.data)) setCandidates(data.data);
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  if (candidates.length === 0) {
    return (
      <div className="rounded-md border border-[var(--border)] p-6 text-center text-sm text-[var(--text-muted)]">
        No pending match candidates. When integrations sync and ambiguous matches are found, they will appear here for review.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[var(--text)]">Pending Review ({candidates.length})</h3>
        <button
          type="button"
          onClick={refresh}
          disabled={loading}
          className="text-sm text-[var(--primary)] hover:underline disabled:opacity-50"
        >
          Refresh
        </button>
      </div>
      <div className="overflow-x-auto rounded-md border border-[var(--border)]">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border)] bg-[var(--bg-muted)]">
              <th className="px-4 py-2 text-left font-medium text-[var(--text)]">Object type</th>
              <th className="px-4 py-2 text-left font-medium text-[var(--text)]">Provider</th>
              <th className="px-4 py-2 text-left font-medium text-[var(--text)]">External ID</th>
              <th className="px-4 py-2 text-left font-medium text-[var(--text)]">Proposed entity</th>
              <th className="px-4 py-2 text-left font-medium text-[var(--text)]">Confidence</th>
              <th className="px-4 py-2 text-left font-medium text-[var(--text)]">Created</th>
              <th className="px-4 py-2 text-left font-medium text-[var(--text)]">Actions</th>
            </tr>
          </thead>
          <tbody>
            {candidates.map((c) => (
              <tr key={c.id} className="border-b border-[var(--border)] last:border-0">
                <td className="px-4 py-2 text-[var(--text)]">{c.primary_object_type}</td>
                <td className="px-4 py-2 text-[var(--text)]">{c.primary_provider}</td>
                <td className="px-4 py-2 font-mono text-xs text-[var(--text-muted)]">{c.primary_external_id}</td>
                <td className="px-4 py-2 text-[var(--text)]">{c.proposed_entity_type}</td>
                <td className="px-4 py-2 text-[var(--text)]">{(Number(c.confidence_score) * 100).toFixed(1)}%</td>
                <td className="px-4 py-2 text-[var(--text-muted)]">{new Date(c.created_at).toLocaleString()}</td>
                <td className="px-4 py-2">
                  <a
                    href={c.proposed_canonical_entity_id
                      ? `/identity/${c.proposed_canonical_entity_id}?review=${c.id}`
                      : `/admin/identity?review=${c.id}`}
                    className="text-[var(--primary)] hover:underline"
                  >
                    Review
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
