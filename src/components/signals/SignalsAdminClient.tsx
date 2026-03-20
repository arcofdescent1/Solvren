"use client";

/**
 * Phase 3 — Signals admin client (§16).
 */
import * as React from "react";
import { Card, CardBody } from "@/ui";

type Coverage = {
  rawEventsByProvider: Record<string, number>;
  normalizedSignalsByProvider: Record<string, number>;
  totalRawEvents: number;
  totalNormalizedSignals: number;
  unmappedCount: number;
  deadLetterCount: number;
  topSignalKeys: { signalKey: string; count: number }[];
  last24h: { raw: number; normalized: number };
  last7d: { raw: number; normalized: number };
  last30d: { raw: number; normalized: number };
};

export function SignalsAdminClient({ orgId }: { orgId: string }) {
  const [coverage, setCoverage] = React.useState<Coverage | null>(null);
  const [tab, setTab] = React.useState<"coverage" | "raw" | "signals" | "definitions" | "deadletter">("coverage");
  const [loading, setLoading] = React.useState(true);
  const [processing, setProcessing] = React.useState(false);

  const fetchCoverage = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/signals/coverage?orgId=${encodeURIComponent(orgId)}`);
      const data = await res.json();
      if (data.ok && data.data) setCoverage(data.data);
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  React.useEffect(() => {
    fetchCoverage();
  }, [fetchCoverage]);

  const runProcess = async () => {
    setProcessing(true);
    try {
      await fetch("/api/admin/signals/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId, limit: 20 }),
      });
      await fetchCoverage();
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2 border-b border-[var(--border)] pb-2">
        {(["coverage", "raw", "signals", "definitions", "deadletter"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`rounded px-3 py-1.5 text-sm font-medium ${tab === t ? "bg-[var(--primary)] text-white" : "bg-[var(--bg-muted)] text-[var(--text)] hover:bg-[var(--border)]"}`}
          >
            {t === "coverage" && "Coverage"}
            {t === "raw" && "Raw Events"}
            {t === "signals" && "Normalized Signals"}
            {t === "definitions" && "Definitions"}
            {t === "deadletter" && "Dead Letters"}
          </button>
        ))}
      </div>

      {tab === "coverage" && (
        <Card>
          <CardBody>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-[var(--text)]">Signal coverage</h3>
              <button
                type="button"
                onClick={runProcess}
                disabled={processing || loading}
                className="rounded bg-[var(--primary)] px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
              >
                {processing ? "Processing…" : "Process pending"}
              </button>
            </div>
            {loading ? (
              <p className="mt-4 text-sm text-[var(--text-muted)]">Loading…</p>
            ) : coverage ? (
              <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-lg border border-[var(--border)] p-3">
                  <p className="text-xs text-[var(--text-muted)]">Raw events (total)</p>
                  <p className="text-2xl font-semibold text-[var(--text)]">{coverage.totalRawEvents}</p>
                </div>
                <div className="rounded-lg border border-[var(--border)] p-3">
                  <p className="text-xs text-[var(--text-muted)]">Normalized signals</p>
                  <p className="text-2xl font-semibold text-[var(--text)]">{coverage.totalNormalizedSignals}</p>
                </div>
                <div className="rounded-lg border border-[var(--border)] p-3">
                  <p className="text-xs text-[var(--text-muted)]">Unmapped</p>
                  <p className="text-2xl font-semibold text-[var(--text)]">{coverage.unmappedCount}</p>
                </div>
                <div className="rounded-lg border border-[var(--border)] p-3">
                  <p className="text-xs text-[var(--text-muted)]">Dead letter</p>
                  <p className="text-2xl font-semibold text-[var(--text)]">{coverage.deadLetterCount}</p>
                </div>
                <div className="rounded-lg border border-[var(--border)] p-3 sm:col-span-2">
                  <p className="text-xs text-[var(--text-muted)]">Last 24h / 7d / 30d</p>
                  <p className="text-sm text-[var(--text)]">
                    Raw: {coverage.last24h.raw} / {coverage.last7d.raw} / {coverage.last30d.raw} — Normalized:{" "}
                    {coverage.last24h.normalized} / {coverage.last7d.normalized} / {coverage.last30d.normalized}
                  </p>
                </div>
                {coverage.topSignalKeys.length > 0 && (
                  <div className="rounded-lg border border-[var(--border)] p-3 sm:col-span-2">
                    <p className="text-xs text-[var(--text-muted)]">Top signal keys</p>
                    <ul className="mt-1 space-y-0.5 text-sm text-[var(--text)]">
                      {coverage.topSignalKeys.slice(0, 5).map((s) => (
                        <li key={s.signalKey}>
                          {s.signalKey}: {s.count}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              <p className="mt-4 text-sm text-[var(--text-muted)]">No coverage data.</p>
            )}
          </CardBody>
        </Card>
      )}

      {tab === "raw" && (
        <Card>
          <CardBody>
            <h3 className="text-sm font-semibold text-[var(--text)]">Raw events</h3>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              <a href={`/api/admin/raw-events?orgId=${encodeURIComponent(orgId)}`} className="text-[var(--primary)] hover:underline" target="_blank" rel="noopener noreferrer">
                View raw events API
              </a>
            </p>
          </CardBody>
        </Card>
      )}

      {tab === "signals" && (
        <Card>
          <CardBody>
            <h3 className="text-sm font-semibold text-[var(--text)]">Normalized signals</h3>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              <a href={`/api/admin/normalized-signals?orgId=${encodeURIComponent(orgId)}`} className="text-[var(--primary)] hover:underline" target="_blank" rel="noopener noreferrer">
                View normalized signals API
              </a>
            </p>
          </CardBody>
        </Card>
      )}

      {tab === "definitions" && (
        <Card>
          <CardBody>
            <h3 className="text-sm font-semibold text-[var(--text)]">Signal definitions</h3>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              <a href="/api/admin/signals/definitions" className="text-[var(--primary)] hover:underline" target="_blank" rel="noopener noreferrer">
                View signal definitions API
              </a>
            </p>
          </CardBody>
        </Card>
      )}

      {tab === "deadletter" && (
        <Card>
          <CardBody>
            <h3 className="text-sm font-semibold text-[var(--text)]">Dead letter queue</h3>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              <a href={`/api/admin/dead-letter?orgId=${encodeURIComponent(orgId)}`} className="text-[var(--primary)] hover:underline" target="_blank" rel="noopener noreferrer">
                View dead letter API
              </a>
            </p>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
