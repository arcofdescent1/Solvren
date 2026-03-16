"use client";;
import { Button } from "@/ui";

import { useEffect, useState } from "react";

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border bg-neutral-50 px-3 py-1 text-xs">
      {children}
    </span>
  );
}

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

  async function load() {
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
  }

  useEffect(() => {
    load();
  }, [props.changeId]);

  async function applyApprovals() {
    setApplyA(true);
    setToast(null);
    try {
      const res = await fetch(
        `/api/changes/${props.changeId}/apply-approval-suggestions`,
        { method: "POST" }
      );
      const json = await res.json();
      if (!res.ok) throw new Error((json as { error?: string }).error || "Failed");
      setToast("Approvals queued ✅");
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
      const res = await fetch(
        `/api/changes/${props.changeId}/apply-evidence-suggestions`,
        { method: "POST" }
      );
      const json = await res.json();
      if (!res.ok) throw new Error((json as { error?: string }).error || "Failed");
      setToast(`Added ${(json as { applied?: number }).applied ?? 0} evidence item(s).`);
      window.dispatchEvent(new CustomEvent("evidence:refresh"));
    } catch (e: unknown) {
      setToast(e instanceof Error ? e.message : "Failed");
    } finally {
      setApplyE(false);
    }
  }

  return (
    <div className="mt-4 rounded-2xl border bg-white p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-sm font-semibold">AI → Workflow suggestions</div>
          <div className="text-xs text-neutral-500">
            Use the report to pre-fill approvers and evidence. One click.
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            className="rounded-xl border px-3 py-2 text-sm font-semibold hover:bg-neutral-50 disabled:opacity-50"
            onClick={applyApprovals}
            disabled={applyA || loading || !s}
          >
            {applyA ? "Applying…" : "Apply approval set"}
          </Button>
          <Button
            type="button"
            className="rounded-xl border px-3 py-2 text-sm font-semibold hover:bg-neutral-50 disabled:opacity-50"
            onClick={applyEvidence}
            disabled={applyE || loading || !s}
          >
            {applyE ? "Adding…" : "Add evidence checklist"}
          </Button>
        </div>
      </div>
      {toast ? (
        <div className="mt-3 text-sm text-neutral-700">{toast}</div>
      ) : null}
      {loading ? (
        <div className="mt-3 text-sm text-neutral-600">Loading suggestions…</div>
      ) : err ? (
        <div className="mt-3 text-sm text-neutral-600">Error: {err}</div>
      ) : !s ? (
        <div className="mt-3 text-sm text-neutral-600">
          Generate a Revenue Impact Report to see suggestions.
        </div>
      ) : (
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div className="rounded-xl border bg-neutral-50 p-3">
            <div className="text-xs font-semibold text-neutral-700">
              Suggested approvals
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {(s.suggestedApprovalAreas ?? []).length ? (
                (s.suggestedApprovalAreas ?? []).map((a) => (
                  <Chip key={a}>{a}</Chip>
                ))
              ) : (
                <div className="text-xs text-neutral-500">
                  No mapped approval areas (configure in Settings → Approval role map (AI labels)).
                </div>
              )}
            </div>
            <div className="mt-2 text-xs text-neutral-500">
              From report requiredApprovals:{" "}
              {(s.requiredApprovalsRaw ?? []).join(", ") || "—"}
            </div>
          </div>

          <div className="rounded-xl border bg-neutral-50 p-3">
            <div className="text-xs font-semibold text-neutral-700">
              Suggested evidence checklist
            </div>
            <ul className="mt-2 list-disc pl-5 text-sm text-neutral-700">
              {(s.suggestedEvidenceItems ?? [])
                .slice(0, 8)
                .map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
            </ul>
            {(s.suggestedEvidenceItems ?? []).length > 8 ? (
              <div className="mt-1 text-xs text-neutral-500">
                + {(s.suggestedEvidenceItems ?? []).length - 8} more…
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
