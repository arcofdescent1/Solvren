"use client";

import { useEffect, useState } from "react";

const pct1 = (x?: number) => (x == null ? "-" : `${(x * 100).toFixed(1)}%`);
const pct0 = (x?: number) => (x == null ? "-" : `${Math.round((x ?? 0) * 100)}%`);

type PredictionData = {
  bayes: { mean?: number; ciLow?: number; ciHigh?: number; confidence?: number };
  ml: number | null;
  blended: { final: number; alpha: number; ml: number | null };
};

export default function PredictionBadge(props: { changeId: string }) {
  const { changeId } = props;
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [data, setData] = useState<PredictionData | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const res = await fetch(`/api/changes/${changeId}/prediction`);
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error || "Failed to load prediction");
        if (!mounted) return;
        setData({
          bayes: json.bayes ?? {},
          ml: json.ml ?? null,
          blended: json.blended ?? { final: json.bayes?.mean ?? 0, alpha: 0, ml: null },
        });
      } catch (e: unknown) {
        if (!mounted) return;
        setErr(e instanceof Error ? e.message : "Failed");
      } finally {
        if (!mounted) return;
        setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [changeId]);

  if (loading) {
    return (
      <div className="inline-flex h-10 items-center gap-2 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-surface)] px-3 text-xs text-[var(--text-muted)]">
        Predicting...
      </div>
    );
  }

  if (err || !data) {
    return (
      <div className="inline-flex h-10 items-center gap-2 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-surface)] px-3 text-xs text-[var(--text-muted)]">
        Prediction unavailable
      </div>
    );
  }

  const { bayes, ml, blended } = data;

  return (
    <div className="inline-flex flex-wrap items-center gap-2">
      <div className="inline-flex h-10 items-center gap-2 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-surface)] px-3 text-xs shadow-sm">
        <div className="font-semibold text-[var(--text)]">Prediction</div>
        <div className="text-[var(--text-muted)]">
          {pct1(blended.final)} <span>(90% CI {pct1(bayes.ciLow)}-{pct1(bayes.ciHigh)})</span>
        </div>
        <button
          className="text-xs font-semibold text-[var(--primary)] hover:underline"
          onClick={() => setOpen((v) => !v)}
          type="button"
        >
          details
        </button>
      </div>
      {open ? (
        <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2 text-xs text-[var(--text)] shadow-sm">
          <div>
            <span className="font-semibold">Bayes:</span> {pct1(bayes.mean)} (conf {pct0(bayes.confidence)})
          </div>
          <div>
            <span className="font-semibold">ML:</span> {ml == null ? "-" : pct1(ml)}
          </div>
          <div className="text-[var(--text-muted)]">blend weight: {pct0(blended.alpha)}</div>
        </div>
      ) : null}
    </div>
  );
}
