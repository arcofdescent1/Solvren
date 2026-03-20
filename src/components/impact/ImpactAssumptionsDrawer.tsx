"use client";

import { useEffect, useState } from "react";
import { Card, CardBody } from "@/ui";

export type ImpactAssumptionsDrawerProps = {
  issueId: string;
  modelKey: string;
  modelVersion: string;
  open: boolean;
  onClose: () => void;
};

export function ImpactAssumptionsDrawer({
  issueId,
  modelKey,
  modelVersion,
  open,
  onClose,
}: ImpactAssumptionsDrawerProps) {
  const [assumptions, setAssumptions] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !issueId) return;
    queueMicrotask(() => setLoading(true));
    fetch(`/api/issues/${issueId}/impact?expand=breakdown,assumptions`)
      .then((r) => r.json())
      .then((d) => setAssumptions(d.assumptionsSnapshot ?? null))
      .finally(() => setLoading(false));
  }, [open, issueId]);

  if (!open) return null;

  const entries = assumptions ? Object.entries(assumptions) : [];

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-label="Assumptions used">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} aria-hidden />
      <div className="relative w-full max-w-md bg-[var(--bg-surface)] shadow-xl overflow-y-auto">
        <Card className="rounded-none border-0">
          <CardBody>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Assumptions used</h2>
              <button
                type="button"
                onClick={onClose}
                className="text-[var(--text-muted)] hover:text-[var(--text)] p-1"
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <p className="text-sm text-[var(--text-muted)] mb-3">
              {modelKey} v{modelVersion}
            </p>
            {loading ? (
              <p className="text-sm text-[var(--text-muted)]">Loading…</p>
            ) : entries.length === 0 ? (
              <p className="text-sm text-[var(--text-muted)]">No assumptions recorded for this assessment.</p>
            ) : (
              <dl className="space-y-2">
                {entries.map(([key, value]) => (
                  <div key={key} className="flex justify-between gap-4 py-2 border-b border-[var(--border)] last:border-0">
                    <dt className="text-sm text-[var(--text-muted)] font-medium">{key.replace(/_/g, " ")}</dt>
                    <dd className="text-sm font-mono">
                      {typeof value === "number" ? value.toLocaleString() : String(value)}
                    </dd>
                  </div>
                ))}
              </dl>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
