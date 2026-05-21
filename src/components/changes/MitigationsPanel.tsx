"use client";

import { useEffect, useState } from "react";
import { Card, CardBody, CardDescription, CardHeader, CardTitle } from "@/ui";

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
      return <span className={`${base} border-red-300 bg-red-50 text-red-700`}>Critical</span>;
    case "HIGH":
      return <span className={`${base} border-orange-300 bg-orange-50 text-orange-700`}>High</span>;
    case "MEDIUM":
      return <span className={`${base} border-yellow-300 bg-yellow-50 text-yellow-800`}>Medium</span>;
    default:
      return <span className={`${base} border-[var(--border)] bg-[var(--bg-surface-2)] text-[var(--text-muted)]`}>Low</span>;
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
        if (!res.ok) throw new Error((json as { error?: string }).error || "Safeguard recommendations could not be loaded.");
        if (mounted) setItems((json as { mitigations?: Mitigation[] }).mitigations ?? []);
      } catch (e: unknown) {
        if (mounted) setErr(e instanceof Error ? e.message : "Safeguard recommendations could not be loaded.");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [props.changeId]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Safeguard recommendations</CardTitle>
        <CardDescription>Practical steps reviewers can ask for before approving this change.</CardDescription>
      </CardHeader>
      <CardBody>

      {loading ? <div className="mt-3 text-sm text-[var(--text-muted)]">Loading...</div> : null}
      {err ? <div className="mt-3 text-sm text-[var(--danger)]">{err}</div> : null}

      {!loading && !err && items.length === 0 ? (
        <div className="mt-3 rounded-[var(--radius-md)] bg-[var(--bg-surface-2)] p-3 text-sm text-[var(--text)]">
          No additional safeguards are recommended yet.
          <div className="mt-1 text-xs text-[var(--text-muted)]">
            This will update as the assessment gathers more evidence and review factors.
          </div>
        </div>
      ) : null}

      <div className="mt-3 space-y-2">
        {items.map((m, idx) => (
          <div key={`${m.signalKey}-${idx}`} className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-surface)] p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="text-sm font-semibold">{m.recommendation}</div>
              {severityBadge(m.severity)}
            </div>
            <div className="mt-1 text-xs text-[var(--text-muted)]">Source factor: {m.signalKey}</div>
          </div>
        ))}
      </div>
      </CardBody>
    </Card>
  );
}
