"use client";

import * as React from "react";
import type { ExecutiveDecisionApi } from "@/lib/executive/types";

export function ExecutiveTokenDecisionClient({ token }: { token: string }) {
  const [comment, setComment] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [done, setDone] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  async function submit(d: ExecutiveDecisionApi) {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/external-actions/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          decision: d,
          comment: comment.trim() || null,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; reasons?: string[] };
      if (!res.ok) {
        setErr(
          Array.isArray(data.reasons) && data.reasons.length
            ? data.reasons.join("; ")
            : data.error ?? "Request failed"
        );
        setBusy(false);
        return;
      }
      setDone(true);
    } catch {
      setErr("Network error");
    }
    setBusy(false);
  }

  if (done) {
    return (
      <p className="text-sm font-medium text-green-700" role="status">
        Your decision was recorded. You can close this page.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <label className="block text-sm">
        <span className="font-medium text-neutral-900">Comment</span>
        <textarea
          className="mt-1 w-full rounded-md border border-neutral-300 p-2 text-sm shadow-sm"
          rows={3}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Required for Deny, Escalate, and Request info"
        />
      </label>
      {err ? (
        <p className="text-sm text-red-600" role="alert">
          {err}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          className="rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
          onClick={() => void submit("APPROVE")}
        >
          Approve
        </button>
        <button
          type="button"
          disabled={busy}
          className="rounded-md bg-red-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
          onClick={() => void submit("DENY")}
        >
          Deny
        </button>
        <button
          type="button"
          disabled={busy}
          className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm font-medium disabled:opacity-50"
          onClick={() => void submit("REQUEST_INFO")}
        >
          Request info
        </button>
        <button
          type="button"
          disabled={busy}
          className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm font-medium disabled:opacity-50"
          onClick={() => void submit("DELAY")}
        >
          Delay 24h
        </button>
        <button
          type="button"
          disabled={busy}
          className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm font-medium disabled:opacity-50"
          onClick={() => void submit("ESCALATE")}
        >
          Escalate
        </button>
      </div>
    </div>
  );
}
