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
        const res = await fetch(
          `/api/changes/ready-status?changeId=${encodeURIComponent(changeId)}`
        );
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json?.error ?? "Failed to load readiness");
        if (!cancelled) setData(json as ReadyStatus);
      } catch (e) {
        if (!cancelled)
          setErr(
            e instanceof Error ? e.message : "Failed to load readiness"
          );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [changeId]);

  if (err) {
    return (
      <div className="mt-2 text-xs text-red-600">Readiness error: {err}</div>
    );
  }
  if (!data) {
    return (
      <div className="mt-2 text-xs opacity-60">Checking readiness…</div>
    );
  }

  if (data.ready) {
    const isSubmitMode = data.mode === "submit";
    return (
      <div className="mt-2 border rounded px-3 py-2 text-sm bg-green-50 dark:bg-green-950/30">
        <span className="font-semibold">
          {isSubmitMode ? "READY FOR SUBMISSION" : "READY FOR APPROVAL"} ✅
        </span>
        <span className="ml-2 text-xs opacity-70">
          Domain {data.domain} • Bucket {data.bucket ?? "—"}
        </span>
      </div>
    );
  }

  const submissionIssues = data.submissionIssues ?? [];
  const readinessChecks = data.readinessChecks ?? [];
  const missingCount =
    submissionIssues.length ||
    data.missingEvidence.length +
      data.missingApprovalAreas.length +
      data.blockingIncidents.length;
  const isSubmitMode = data.mode === "submit";

  const statusIcon = (s: ReadinessCheckItem["status"]) => {
    if (s === "pass") return "✓";
    if (s === "error") return "✗";
    return "⚠";
  };

  return (
    <div className="mt-2 border rounded px-3 py-2 text-sm bg-red-50 dark:bg-red-950/30 space-y-1">
      <div className="font-semibold">
        {submissionIssues.length > 0 ? "NOT READY FOR SUBMISSION" : "NOT READY"} ❌ ({missingCount} {submissionIssues.length ? "issues" : "blockers"})
      </div>

      {isSubmitMode && readinessChecks.length > 0 && (
        <div className="text-xs opacity-90 space-y-0.5">
          <div className="font-medium">Readiness Check</div>
          {readinessChecks.map((c) => (
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
                <span className="opacity-80 ml-1">— {c.message}</span>
              )}
            </div>
          ))}
        </div>
      )}

      {((isSubmitMode && readinessChecks.length === 0) || !isSubmitMode) &&
        submissionIssues.length > 0 && (
          <div className="text-xs opacity-80">
            {submissionIssues.map((s, i) => (
              <div key={i}>{s}</div>
            ))}
          </div>
        )}

      {data.missingEvidence.length > 0 && (
        <div className="text-xs opacity-80">
          Missing evidence: {data.missingEvidence.join(", ")}{" "}
          <Link href="#evidence-panel" className="underline ml-1">
            Fix
          </Link>
        </div>
      )}

      {data.missingApprovalAreas.length > 0 && (
        <div className="text-xs opacity-80">
          Missing approvals: {data.missingApprovalAreas.join(", ")}
        </div>
      )}

      {data.blockingIncidents.length > 0 && (
        <div className="text-xs opacity-80">
          Blocking incidents:{" "}
          {data.blockingIncidents.map((i) => i.id).join(", ")}
        </div>
      )}
    </div>
  );
}
