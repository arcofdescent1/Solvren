"use client";

import { useState } from "react";
import { EXPLICIT_LABEL_TYPES } from "@/modules/learning/types/label-schema";

export function GovernanceDecisionFeedback({ traceId }: { traceId: string }) {
  const [labelType, setLabelType] = useState<string>(EXPLICIT_LABEL_TYPES[0]);
  const [rationale, setRationale] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "done" | "err">("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function submit() {
    setStatus("saving");
    setMessage(null);
    try {
      const res = await fetch("/api/settings/governance/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          traceId,
          labelType,
          rationale: rationale.trim() || undefined,
        }),
      });
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setStatus("err");
        setMessage(j.error ?? "Request failed");
        return;
      }
      setStatus("done");
      setMessage("Feedback recorded.");
      setRationale("");
    } catch {
      setStatus("err");
      setMessage("Network error");
    }
  }

  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 space-y-3">
      <h3 className="text-sm font-medium">Learning feedback</h3>
      <p className="text-xs text-[var(--text-muted)]">
        Labels attach to this decision trace for calibration and review. They are auditable and append-only.
      </p>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <label className="flex-1 text-sm">
          <span className="text-[var(--text-muted)] block mb-1">Label</span>
          <select
            className="w-full rounded border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 text-sm"
            value={labelType}
            onChange={(e) => setLabelType(e.target.value)}
            disabled={status === "saving"}
          >
            {EXPLICIT_LABEL_TYPES.map((t) => (
              <option key={t} value={t}>
                {t.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="rounded bg-[var(--primary)] px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
          onClick={() => void submit()}
          disabled={status === "saving"}
        >
          {status === "saving" ? "Saving…" : "Submit"}
        </button>
      </div>
      <label className="block text-sm">
        <span className="text-[var(--text-muted)]">Optional comment</span>
        <textarea
          className="mt-1 w-full rounded border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 text-sm min-h-[72px]"
          value={rationale}
          onChange={(e) => setRationale(e.target.value)}
          disabled={status === "saving"}
          maxLength={4000}
        />
      </label>
      {message && (
        <p className={`text-sm ${status === "err" ? "text-red-600 dark:text-red-400" : "text-[var(--text-muted)]"}`}>
          {message}
        </p>
      )}
    </div>
  );
}
