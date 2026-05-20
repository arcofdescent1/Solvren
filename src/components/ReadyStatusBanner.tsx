"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type ReadinessCheckItem = {
  code: string;
  label: string;
  status: "pass" | "error" | "warning";
  message?: string;
};

type ReadyStatus = {
  ready: boolean;
  domain: string;
  bucket: string | null;
  missingEvidence: string[];
  missingApprovalAreas: string[];
  blockingIncidents: Array<{ id: string; status: string | null }>;
  submissionIssues?: string[];
  readinessChecks?: ReadinessCheckItem[];
  mode?: "submit" | "approval";
};

export default function ReadyStatusBanner({ changeId }: { changeId: string }) {
  const [data, setData] = useState<ReadyStatus | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setErr(null);
        const res = await fetch(`/api/changes/ready-status?changeId=${encodeURIComponent(changeId)}`);
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json?.error ?? "Failed to load readiness");
        if (!cancelled) setData(json as ReadyStatus);
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : "Failed to load readiness");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [changeId]);

  if (err) return <div className="mt-3 text-xs text-[var(--danger)]">Readiness error: {err}</div>;
  if (!data) return <div className="mt-3 text-xs text-[var(--text-muted)]">Checking readiness...</div>;

  if (data.ready) {
    const isSubmitMode = data.mode === "submit";
    return (
      <div className="mt-3 rounded-[var(--radius-lg)] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-950 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-100">
        <span className="font-semibold">{isSubmitMode ? "Ready for submission" : "Ready for approval"}</span>
        <span className="ml-2 text-xs opacity-70">
          Domain {data.domain} - Bucket {data.bucket ?? "-"}
        </span>
      </div>
    );
  }

  const submissionIssues = data.submissionIssues ?? [];
  const readinessChecks = data.readinessChecks ?? [];
  const missingCount =
    submissionIssues.length ||
    data.missingEvidence.length + data.missingApprovalAreas.length + data.blockingIncidents.length;
  const isSubmitMode = data.mode === "submit";

  const statusLabel = (s: ReadinessCheckItem["status"]) => {
    if (s === "pass") return "Pass";
    if (s === "error") return "Fix";
    return "Review";
  };

  return (
    <div className="mt-3 space-y-2 rounded-[var(--radius-lg)] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100">
      <div className="font-semibold">
        {submissionIssues.length > 0 ? "Not ready for submission" : "Not ready"} ({missingCount}{" "}
        {submissionIssues.length ? "issues" : "blockers"})
      </div>

      {isSubmitMode && readinessChecks.length > 0 && (
        <div className="space-y-1 text-xs">
          <div className="font-medium">Readiness checks</div>
          {readinessChecks.map((c) => (
            <div key={c.code}>
              <span className="font-semibold">{statusLabel(c.status)}:</span> {c.label}
              {c.message && c.status !== "pass" ? <span className="opacity-80"> - {c.message}</span> : null}
            </div>
          ))}
        </div>
      )}

      {((isSubmitMode && readinessChecks.length === 0) || !isSubmitMode) && submissionIssues.length > 0 ? (
        <div className="text-xs opacity-80">
          {submissionIssues.map((s, i) => (
            <div key={i}>{s}</div>
          ))}
        </div>
      ) : null}

      {data.missingEvidence.length > 0 ? (
        <div className="text-xs opacity-80">
          Missing evidence: {data.missingEvidence.join(", ")}
          <Link href="#evidence-panel" className="ml-1 underline">
            Fix
          </Link>
        </div>
      ) : null}

      {data.missingApprovalAreas.length > 0 ? (
        <div className="text-xs opacity-80">Missing approvals: {data.missingApprovalAreas.join(", ")}</div>
      ) : null}

      {data.blockingIncidents.length > 0 ? (
        <div className="text-xs opacity-80">
          Blocking incidents: {data.blockingIncidents.map((i) => i.id).join(", ")}
        </div>
      ) : null}
    </div>
  );
}
