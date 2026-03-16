"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/ui";
import Link from "next/link";
import type { IntakeDraft } from "../types";
import { RevenueImpactSummary } from "@/components/revenueImpact/RevenueImpactSummary";
import { CoordinationAutopilotCard } from "@/components/coordination/CoordinationAutopilotCard";

type ReadinessCheck = {
  code: string;
  label: string;
  status: "pass" | "error" | "warning";
  message?: string;
};

type ReadyData = {
  ready: boolean;
  readinessChecks?: ReadinessCheck[];
  submissionIssues?: string[];
};

export function ReviewSubmitStep(props: {
  draft: IntakeDraft;
  onDraftChange: (next: Partial<IntakeDraft>) => void;
  onSave: () => Promise<void>;
  saving: boolean;
}) {
  const { draft } = props;
  const router = useRouter();
  const [readyData, setReadyData] = useState<ReadyData | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitMsg, setSubmitMsg] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/changes/ready-status?changeId=${encodeURIComponent(draft.id)}&mode=submit`)
      .then((r) => r.json())
      .then((json) => {
        if (!cancelled) setReadyData(json);
      })
      .catch(() => {
        if (!cancelled) setReadyData(null);
      });
    return () => {
      cancelled = true;
    };
  }, [draft.id]);

  const statusIcon = (s: ReadinessCheck["status"]) => {
    if (s === "pass") return "✓";
    if (s === "error") return "✗";
    return "⚠";
  };

  async function handleSubmit() {
    if (!readyData?.ready || submitting) return;
    setSubmitting(true);
    setSubmitMsg(null);
    try {
      const res = await fetch("/api/changes/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ changeEventId: draft.id }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        const details = (json as { details?: string[] }).details;
        setSubmitMsg(
          (json as { error?: string }).error +
            (Array.isArray(details) && details.length
              ? ": " + details.join("; ")
              : "")
        );
        return;
      }
      router.push(`/changes/${draft.id}`);
      router.refresh();
    } catch {
      setSubmitMsg("Failed to submit");
    } finally {
      setSubmitting(false);
    }
  }

  const checks = readyData?.readinessChecks ?? [];
  const ready = readyData?.ready ?? false;
  const loading = readyData === null;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-[var(--text)]">Review and submit</h2>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Confirm the details below. You can submit when there are no blocking errors.
        </p>
      </div>

      <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-muted)]/30 p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">Summary</p>
        <p className="mt-2 text-sm text-[var(--text)]">
          <strong>Change type:</strong> {(draft.structured_change_type ?? draft.change_type ?? "—").replace(/_/g, " ").toLowerCase()}
          {" · "}
          <strong>System:</strong> {(draft.systems_involved ?? []).join(", ") || "—"}
          {" · "}
          <strong>Impact:</strong> {draft.revenue_surface ?? "—"}
          {" · "}
          Evidence and approvers are assigned at submit.
        </p>
      </div>

      <div className="rounded-lg border border-[var(--border)] p-4">
        <h3 className="text-sm font-medium text-[var(--text)]">Details</h3>
        <dl className="mt-2 grid gap-1 text-sm sm:grid-cols-2">
          <dt className="text-[var(--text-muted)]">Systems</dt>
          <dd>{(draft.systems_involved ?? []).join(", ") || "—"}</dd>
          <dt className="text-[var(--text-muted)]">Change type</dt>
          <dd>
            {draft.structured_change_type ?? draft.change_type ?? "—"}
          </dd>
          <dt className="text-[var(--text-muted)]">Risk area</dt>
          <dd>{draft.domain ?? "REVENUE"}</dd>
          <dt className="text-[var(--text-muted)]">Rollout</dt>
          <dd>{draft.rollout_method ?? "—"}</dd>
          <dt className="text-[var(--text-muted)]">Planned release</dt>
          <dd>
            {draft.planned_release_at
              ? new Date(draft.planned_release_at).toLocaleString()
              : "—"}
          </dd>
        </dl>
      </div>

      <RevenueImpactSummary changeId={draft.id} />
      <CoordinationAutopilotCard changeId={draft.id} compact autoGenerate />

      {loading && (
        <p className="text-sm text-[var(--text-muted)]">Checking readiness…</p>
      )}

      {!loading && checks.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium">Readiness check</h3>
          <div className="space-y-1">
            {checks.map((c) => (
              <div
                key={c.code}
                className={
                  c.status === "pass"
                    ? "text-green-700 dark:text-green-400"
                    : c.status === "error"
                      ? "text-red-700 dark:text-red-400"
                      : "text-amber-700 dark:text-amber-400"
                }
              >
                {statusIcon(c.status)} {c.label}
                {c.message && c.status !== "pass" && (
                  <span className="ml-1 opacity-80">— {c.message}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {submitMsg && (
        <p className="text-sm text-red-600 dark:text-red-400">{submitMsg}</p>
      )}

      <div className="flex flex-wrap items-center gap-3 pt-4">
        <Button
          onClick={handleSubmit}
          disabled={!ready || submitting}
        >
          {submitting ? "Submitting…" : "Submit for review"}
        </Button>
        <Link
          href={`/changes/${draft.id}`}
          className="text-sm text-[var(--primary)] hover:underline"
        >
          Save draft and exit
        </Link>
      </div>
    </div>
  );
}
