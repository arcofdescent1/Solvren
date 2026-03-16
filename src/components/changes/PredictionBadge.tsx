"use client";;
import { Button } from "@/ui";

import { useEffect, useState } from "react";

const pct1 = (x?: number) => (x == null ? "—" : `${(x * 100).toFixed(1)}%`);
const pct0 = (x?: number) => (x == null ? "—" : `${Math.round((x ?? 0) * 100)}%`);

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
      <div className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs text-neutral-600">
        Predicting…
      </div>
    );
  }

  if (err || !data) {
    return (
      <div className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs text-neutral-600">
        Prediction unavailable
      </div>
    );
  }

  const { bayes, ml, blended } = data;

  return (
    <div className="inline-flex flex-wrap items-center gap-2">
      <div className="inline-flex items-center gap-2 rounded-full border bg-white px-3 py-1 dark:bg-neutral-900 dark:border-neutral-700">
        <div className="text-xs font-semibold">Prediction</div>
        <div className="text-xs text-neutral-700 dark:text-neutral-300">
          {pct1(blended.final)}{" "}
          <span className="text-neutral-500 dark:text-neutral-400">
            (90% CI {pct1(bayes.ciLow)}–{pct1(bayes.ciHigh)})
          </span>
        </div>
        <Button
          className="text-xs text-neutral-500 underline"
          onClick={() => setOpen((v) => !v)}
          type="button"
        >
          details
        </Button>
      </div>
      {open ? (
        <div className="rounded-xl border bg-neutral-50 px-3 py-2 text-xs text-neutral-700 dark:bg-neutral-800 dark:border-neutral-700 dark:text-neutral-300">
          <div>
            <span className="font-semibold">Bayes:</span> {pct1(bayes.mean)} (conf {pct0(bayes.confidence)})
          </div>
          <div>
            <span className="font-semibold">ML:</span> {ml == null ? "—" : pct1(ml)}
          </div>
          <div className="text-neutral-500 dark:text-neutral-400">
            blend weight: {pct0(blended.alpha)}
          </div>
        </div>
      ) : null}
    </div>
  );
}
