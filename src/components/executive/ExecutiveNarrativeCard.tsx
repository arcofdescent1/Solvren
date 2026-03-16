"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function ExecutiveNarrativeCard() {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [summary, setSummary] = useState<{
    headline?: string;
    bullets?: string[];
    actions?: string[];
    cited_change_ids?: string[];
  } | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const res = await fetch("/api/ai/exec-summary?days=7");
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error || "Failed");
        if (!mounted) return;
        setSummary(json.summary);
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
  }, []);

  return (
    <div className="rounded-2xl border bg-white p-4">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold">Weekly executive brief (AI)</div>
        <div className="text-xs text-neutral-500">Last 7 days</div>
      </div>

      {loading ? (
        <div className="mt-3 text-sm text-neutral-600">
          Generating narrative…
        </div>
      ) : err ? (
        <div className="mt-3 text-sm text-neutral-600">Unavailable: {err}</div>
      ) : !summary ? (
        <div className="mt-3 text-sm text-neutral-600">No summary.</div>
      ) : (
        <div className="mt-3">
          <div className="text-lg font-bold">{summary.headline}</div>
          <ul className="mt-2 list-disc pl-5 text-sm text-neutral-700">
            {(summary.bullets ?? []).map((b, i) => (
              <li key={i}>{b}</li>
            ))}
          </ul>

          {(summary.actions?.length ?? 0) > 0 ? (
            <>
              <div className="mt-3 text-xs font-semibold text-neutral-700">
                Recommended actions
              </div>
              <ul className="mt-1 list-disc pl-5 text-sm text-neutral-700">
                {summary.actions!.map((a, i) => (
                  <li key={i}>{a}</li>
                ))}
              </ul>
            </>
          ) : null}

          {(summary.cited_change_ids?.length ?? 0) > 0 ? (
            <>
              <div className="mt-3 text-xs font-semibold text-neutral-700">
                Referenced changes
              </div>
              <div className="mt-1 flex flex-wrap gap-2">
                {summary.cited_change_ids!.map((id) => (
                  <Link
                    key={id}
                    href={`/changes/${id}`}
                    className="rounded-full border bg-neutral-50 px-3 py-1 text-xs hover:underline"
                  >
                    {id.slice(0, 8)}
                  </Link>
                ))}
              </div>
            </>
          ) : null}
        </div>
      )}
    </div>
  );
}
