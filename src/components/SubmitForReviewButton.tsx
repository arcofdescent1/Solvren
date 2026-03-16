"use client";;
import { Button } from "@/ui";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

type SubmitResp =
  | { ok: true; alreadySubmitted?: boolean; risk_bucket?: string | null; due_at?: string | null; pass_a_ok?: boolean; suggest_evidence_ok?: boolean; message?: string }
  | { error?: string };

export default function SubmitForReviewButton({
  changeEventId,
  status,
  disabled: disabledByReady,
}: {
  changeEventId: string;
  status: string;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [readyForSubmit, setReadyForSubmit] = useState<boolean | null>(null);

  // Only allow submitting from draft or ready. IN_REVIEW/APPROVED/REJECTED cannot be re-submitted.
  const canSubmit = status === "DRAFT" || status === "READY" || status === "SUBMITTED";

  useEffect(() => {
    if (!canSubmit) {
      setReadyForSubmit(null);
      return;
    }
    let cancelled = false;
    fetch(`/api/changes/ready-status?changeId=${encodeURIComponent(changeEventId)}&mode=submit`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setReadyForSubmit(data.ready === true);
      })
      .catch(() => {
        if (!cancelled) setReadyForSubmit(false);
      });
    return () => { cancelled = true; };
  }, [changeEventId, canSubmit]);

  const notReady = canSubmit && readyForSubmit === false;
  const disabled = !canSubmit || loading || Boolean(disabledByReady) || notReady;

  async function submit() {
    if (!canSubmit || loading || disabledByReady || notReady) return;

    setMsg(null);
    setLoading(true);

    const resp = await fetch("/api/changes/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ changeEventId }),
    });

    const json = (await resp.json().catch(() => ({}))) as SubmitResp;
    setLoading(false);

    if (!resp.ok) {
      const err = json as { error?: string; details?: string[] };
      const detailStr = Array.isArray(err.details) && err.details.length > 0
        ? `: ${err.details.join("; ")}`
        : "";
      setMsg((err?.error ?? "Failed to submit.") + detailStr);
      return;
    }

    const okJson = json as SubmitResp & { risk_bucket?: string; due_at?: string; pass_a_ok?: boolean; alreadySubmitted?: boolean; message?: string };

    if (okJson?.alreadySubmitted) {
      setMsg(okJson?.message ?? "Already in review.");
    } else {
      const bucket = okJson?.risk_bucket ?? "—";
      const due = okJson?.due_at ? new Date(okJson.due_at).toLocaleString() : "—";

      // Keep it friendly and short. Don't scare with AI failures.
      const aiNote = okJson?.pass_a_ok === false ? " (AI skipped)" : "";

      setMsg(`Submitted • ${bucket} • Due ${due}${aiNote}`);
    }

    router.refresh();
    window.dispatchEvent(new CustomEvent("timeline:refresh"));
  }

  // Prefer disabled button over disappearing button: users learn the workflow.
  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        data-testid="submit-for-review"
        onClick={submit}
        disabled={disabled}
        className="px-3 py-2 rounded bg-black text-white text-sm disabled:opacity-50"
        title={
          notReady || disabledByReady
            ? "Complete required fields (systems, rollout, revenue exposure, etc.) to submit."
            : !canSubmit
              ? "Already in review or finalized."
              : "Submit this change for approvals and SLA tracking."
        }
      >
        {loading ? "Submitting..." : "Submit for review"}
      </Button>
      {msg && <div className="text-xs opacity-70 text-right max-w-xs">{msg}</div>}
      {!canSubmit && (
        <div className="text-[11px] opacity-50 text-right">
          Status: {status}
        </div>
      )}
    </div>
  );
}
