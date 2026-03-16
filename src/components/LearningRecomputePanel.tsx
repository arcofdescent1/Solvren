"use client";;
import { Button } from "@/ui";

import { useState } from "react";

export default function LearningRecomputePanel({
  isAdmin,
  baseline,
}: {
  isAdmin: boolean;
  baseline: null | {
    window_days: number;
    min_samples: number;
    alpha: number;
    beta: number;
    baseline_incident_rate_smoothed: number;
    last_computed_at: string | null;
  };
}) {
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function recompute() {
    setLoading(true);
    setErr(null);
    setMsg(null);
    try {
      const res = await fetch("/api/learning/recompute", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ windowDays: baseline?.window_days ?? 14 }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to recompute learning");
      setMsg("Learning recompute started/completed.");
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  const fmtPct = (n: number) => `${Math.round(n * 100)}%`;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Learning</h2>
        {isAdmin && (
          <Button
            type="button"
            className="text-sm border rounded px-2 py-1"
            disabled={loading}
            onClick={recompute}
          >
            {loading ? "Recomputing…" : "Recompute now"}
          </Button>
        )}
      </div>
      <div className="text-sm opacity-80 space-y-1">
        <div>
          Attribution window: <b>{baseline?.window_days ?? 14} days</b>
        </div>
        <div>
          Min samples: <b>{baseline?.min_samples ?? 20}</b>
        </div>
        <div>
          Smoothing: α=<b>{baseline?.alpha ?? 1}</b>, β=<b>{baseline?.beta ?? 4}</b>
        </div>
        <div>
          Baseline (smoothed): <b>{fmtPct(Number(baseline?.baseline_incident_rate_smoothed ?? 0))}</b>
        </div>
        <div>
          Last computed:{" "}
          <b>
            {baseline?.last_computed_at
              ? new Date(baseline.last_computed_at).toLocaleString()
              : "—"}
          </b>
        </div>
      </div>
      {!isAdmin && <div className="text-xs opacity-60">Admin only: recompute controls</div>}
      {msg && <div className="text-sm text-green-700">{msg}</div>}
      {err && <div className="text-sm text-red-600">{err}</div>}
    </div>
  );
}
