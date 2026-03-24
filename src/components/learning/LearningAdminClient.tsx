"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

type Overview = {
  controls: {
    globalDisabled: boolean;
    orgLearningDisabled: boolean;
    calibrationDisabled: boolean;
    ruleSuggestionsDisabled: boolean;
    autonomySuggestionsDisabled: boolean;
  };
  drift: {
    windowStart: string;
    windowEnd: string;
    dispositionShares: Record<string, number>;
    sampleSize: number;
  } | null;
  recommendationQuality: {
    total: number;
    accepted: number;
    rejected: number;
    draft: number;
    acceptanceRate: number | null;
  } | null;
  suggestions: Array<{
    id: string;
    suggestion_type: string;
    status: string;
    created_at: string;
    target_policy_id: string | null;
  }>;
  calibrations: Array<{
    id: string;
    parameter_key: string;
    status: string;
    created_at: string;
  }>;
};

export function LearningAdminClient() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [acceptNotice, setAcceptNotice] = useState<string | null>(null);
  const [draftPolicyId, setDraftPolicyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadErr(null);
    const res = await fetch("/api/settings/governance/learning/overview");
    const j = (await res.json().catch(() => ({}))) as Overview & { ok?: boolean; error?: string };
    if (!res.ok) {
      setLoadErr(j.error ?? "Failed to load overview");
      return;
    }
    setOverview({
      controls: j.controls,
      drift: j.drift ?? null,
      recommendationQuality: j.recommendationQuality ?? null,
      suggestions: j.suggestions ?? [],
      calibrations: j.calibrations ?? [],
    });
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function runOrchestrator(kind: "all" | "implicit_labels" | "calibration" | "rule_suggestions" | "autonomy") {
    setBusy(kind);
    try {
      const res = await fetch("/api/settings/governance/learning/orchestrate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        setLoadErr(j.error ?? "Orchestrator failed");
        return;
      }
      await load();
    } finally {
      setBusy(null);
    }
  }

  async function reviewSuggestion(
    id: string,
    status: "REVIEWED" | "ACCEPTED" | "REJECTED",
    opts?: { createPolicyDraft?: boolean }
  ) {
    setBusy(`sg-${id}`);
    setAcceptNotice(null);
    setDraftPolicyId(null);
    try {
      const body: Record<string, unknown> = { status };
      if (status === "ACCEPTED" && opts?.createPolicyDraft === false) {
        body.createPolicyDraft = false;
      }
      const res = await fetch(`/api/settings/governance/learning/suggestions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = (await res.json().catch(() => ({}))) as {
        error?: string;
        draftPolicyId?: string | null;
        draftSkippedReason?: string;
      };
      if (!res.ok) {
        setLoadErr(j.error ?? "Update failed");
        return;
      }
      if (status === "ACCEPTED") {
        if (j.draftPolicyId) {
          setDraftPolicyId(j.draftPolicyId);
          setAcceptNotice("Draft policy created — edit and activate from Policy Center when ready.");
        } else if (j.draftSkippedReason === "no_target_policy") {
          setAcceptNotice("Accepted (no target policy — no draft created).");
        } else if (j.draftSkippedReason) {
          setAcceptNotice(`Accepted (${j.draftSkippedReason}).`);
        }
      }
      await load();
    } finally {
      setBusy(null);
    }
  }

  async function reviewCalibration(id: string, status: "REVIEWED" | "ACCEPTED" | "REJECTED") {
    setBusy(`cal-${id}`);
    try {
      const res = await fetch(`/api/settings/governance/learning/calibrations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        setLoadErr(j.error ?? "Update failed");
        return;
      }
      await load();
    } finally {
      setBusy(null);
    }
  }

  if (!overview && !loadErr) {
    return <p className="text-sm text-[var(--text-muted)]">Loading…</p>;
  }

  return (
    <div className="space-y-6">
      {loadErr && (
        <div className="rounded border border-red-200 bg-red-50 dark:bg-red-950/30 px-3 py-2 text-sm text-red-800 dark:text-red-200">
          {loadErr}
        </div>
      )}

      {overview && (
        <>
          <div className="rounded-lg border border-[var(--border)] p-4 space-y-2 text-sm">
            <h3 className="font-medium">Kill switches</h3>
            <ul className="text-[var(--text-muted)] space-y-1">
              <li>Global env disable: {overview.controls.globalDisabled ? "on" : "off"}</li>
              <li>Org learning disabled: {overview.controls.orgLearningDisabled ? "on" : "off"}</li>
              <li>Calibration: {overview.controls.calibrationDisabled ? "off" : "on"}</li>
              <li>Rule suggestions: {overview.controls.ruleSuggestionsDisabled ? "off" : "on"}</li>
              <li>Autonomy suggestions: {overview.controls.autonomySuggestionsDisabled ? "off" : "on"}</li>
            </ul>
            <p className="text-xs text-[var(--text-muted)]">
              Configure org flags via PATCH <code className="text-xs">/api/settings/governance/learning/settings</code> or future settings UI.
            </p>
          </div>

          <div className="rounded-lg border border-[var(--border)] p-4 space-y-2 text-sm">
            <h3 className="font-medium">Disposition drift (30d window)</h3>
            {overview.drift ? (
              <>
                <p className="text-[var(--text-muted)]">Sample: {overview.drift.sampleSize}</p>
                <pre className="text-xs overflow-x-auto bg-[var(--surface)] p-2 rounded">
                  {JSON.stringify(overview.drift.dispositionShares, null, 2)}
                </pre>
              </>
            ) : (
              <p className="text-[var(--text-muted)]">No drift snapshot.</p>
            )}
          </div>

          <div className="rounded-lg border border-[var(--border)] p-4 space-y-2 text-sm">
            <h3 className="font-medium">Rule suggestion quality</h3>
            {overview.recommendationQuality ? (
              <ul className="text-[var(--text-muted)] space-y-1">
                <li>Total: {overview.recommendationQuality.total}</li>
                <li>Accepted: {overview.recommendationQuality.accepted}</li>
                <li>Rejected: {overview.recommendationQuality.rejected}</li>
                <li>Draft / in review: {overview.recommendationQuality.draft}</li>
                <li>
                  Acceptance rate (of decided):{" "}
                  {overview.recommendationQuality.acceptanceRate != null
                    ? `${(overview.recommendationQuality.acceptanceRate * 100).toFixed(1)}%`
                    : "—"}
                </li>
              </ul>
            ) : (
              <p className="text-[var(--text-muted)]">No data.</p>
            )}
          </div>

          <div className="rounded-lg border border-[var(--border)] p-4 space-y-3">
            <h3 className="font-medium text-sm">Run jobs</h3>
            <p className="text-xs text-[var(--text-muted)]">
              Generates draft recommendations only. Does not change production policy.
            </p>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  ["all", "Run all"],
                  ["implicit_labels", "Implicit labels"],
                  ["calibration", "Calibration"],
                  ["rule_suggestions", "Rule suggestions"],
                  ["autonomy", "Autonomy"],
                ] as const
              ).map(([kind, label]) => (
                <button
                  key={kind}
                  type="button"
                  disabled={!!busy || overview.controls.globalDisabled || overview.controls.orgLearningDisabled}
                  className="rounded border border-[var(--border)] px-2 py-1 text-xs font-medium hover:bg-[var(--surface)] disabled:opacity-50"
                  onClick={() => void runOrchestrator(kind)}
                >
                  {busy === kind ? "…" : label}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-[var(--border)] p-4 space-y-2">
            <h3 className="font-medium text-sm">Calibration queue</h3>
            {!overview.calibrations.length ? (
              <p className="text-sm text-[var(--text-muted)]">None.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {overview.calibrations.map((c) => (
                  <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] pb-2">
                    <span>
                      {c.parameter_key} · {c.status}
                    </span>
                    <span className="flex gap-1">
                      <button
                        type="button"
                        className="text-xs underline disabled:opacity-50"
                        disabled={!!busy}
                        onClick={() => void reviewCalibration(c.id, "REVIEWED")}
                      >
                        Mark reviewed
                      </button>
                      <button
                        type="button"
                        className="text-xs underline disabled:opacity-50"
                        onClick={() => void reviewCalibration(c.id, "REJECTED")}
                      >
                        Reject
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-lg border border-[var(--border)] p-4 space-y-2">
            <h3 className="font-medium text-sm">Rule suggestions</h3>
            {acceptNotice && (
              <p className="text-xs text-[var(--text-muted)] border border-[var(--border)] rounded px-2 py-1.5 space-y-1">
                <span className="block">{acceptNotice}</span>
                {draftPolicyId ? (
                  <Link
                    href={`/admin/policy/${draftPolicyId}`}
                    className="inline-block font-medium text-[var(--primary)] hover:underline"
                  >
                    Open draft policy →
                  </Link>
                ) : null}
              </p>
            )}
            {!overview.suggestions.length ? (
              <p className="text-sm text-[var(--text-muted)]">None.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {overview.suggestions.map((s) => (
                  <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] pb-2">
                    <span className="min-w-0">
                      {s.suggestion_type} · {s.status}
                    </span>
                    <span className="flex flex-wrap gap-1 justify-end">
                      {s.status !== "ACCEPTED" && s.status !== "REJECTED" ? (
                        <>
                          <button
                            type="button"
                            className="text-xs underline disabled:opacity-50"
                            disabled={!!busy}
                            onClick={() => void reviewSuggestion(s.id, "REVIEWED")}
                          >
                            Mark reviewed
                          </button>
                          <button
                            type="button"
                            className="text-xs font-medium text-[var(--primary)] disabled:opacity-50"
                            disabled={!!busy}
                            onClick={() => void reviewSuggestion(s.id, "ACCEPTED")}
                          >
                            Accept → draft
                          </button>
                          <button
                            type="button"
                            className="text-xs underline disabled:opacity-50"
                            disabled={!!busy}
                            onClick={() => void reviewSuggestion(s.id, "REJECTED")}
                          >
                            Reject
                          </button>
                        </>
                      ) : null}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}
