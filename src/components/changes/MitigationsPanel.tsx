"use client";

import { useEffect, useState } from "react";

type Mitigation = {
  signalKey: string;
  recommendation: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  metadata?: Record<string, unknown>;
};

function severityBadge(sev: Mitigation["severity"]) {
  const base = "rounded-full border px-2 py-0.5 text-xs font-semibold";
  switch (sev) {
    case "CRITICAL":
      return (
        <span
          className={`${base} border-red-300 bg-red-50 text-red-700`}
        >
          CRITICAL
        </span>
      );
    case "HIGH":
      return (
        <span
          className={`${base} border-orange-300 bg-orange-50 text-orange-700`}
        >
          HIGH
        </span>
      );
    case "MEDIUM":
      return (
        <span
          className={`${base} border-yellow-300 bg-yellow-50 text-yellow-800`}
        >
          MEDIUM
        </span>
      );
    default:
      return (
        <span
          className={`${base} border-neutral-300 bg-neutral-50 text-neutral-700`}
        >
          LOW
        </span>
      );
  }
}

export function MitigationsPanel(props: {
  changeId: string;
  orgId?: string;
}) {
  const [items, setItems] = useState<Mitigation[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const res = await fetch(`/api/changes/${props.changeId}/mitigations`);
        const json = await res.json();
        if (!res.ok)
          throw new Error(
            (json as { error?: string }).error || "Failed to load mitigations"
          );
        if (mounted) setItems((json as { mitigations?: Mitigation[] }).mitigations ?? []);
      } catch (e: unknown) {
        if (mounted)
          setErr(
            e instanceof Error ? e.message : "Failed to load mitigations"
          );
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [props.changeId]);

  return (
    <div className="rounded-2xl border p-4 shadow-sm">
      <div className="text-lg font-semibold">Mitigation Recommendations</div>
      <div className="text-sm text-neutral-600">
        Actionable steps tied to the signals on this change.
      </div>

      {loading ? (
        <div className="mt-3 text-sm text-neutral-600">Loading…</div>
      ) : null}
      {err ? (
        <div className="mt-3 text-sm text-red-600">{err}</div>
      ) : null}

      {!loading && !err && items.length === 0 ? (
        <div className="mt-3 rounded-xl bg-neutral-50 p-3 text-sm text-neutral-700">
          No mitigations found yet for the detected signals.
          <div className="mt-1 text-xs text-neutral-500">
            Tip: seed defaults on org bootstrap, then expand per domain.
          </div>
        </div>
      ) : null}

      <div className="mt-3 space-y-2">
        {items.map((m, idx) => (
          <div
            key={`${m.signalKey}-${idx}`}
            className="rounded-xl border bg-white p-3"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-semibold">{m.signalKey}</div>
              {severityBadge(m.severity)}
            </div>
            <div className="mt-1 text-sm text-neutral-700">
              {m.recommendation}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
