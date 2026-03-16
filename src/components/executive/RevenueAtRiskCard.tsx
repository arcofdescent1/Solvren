"use client";

import { useEffect, useMemo, useState } from "react";

type Metrics = {
  since: string;
  revenue_at_risk: number;
  by_surface: Array<{ revenue_surface: string; revenue_at_risk: number; count: number }>;
  trend: Array<{ day: string; revenue_at_risk: number }>;
  critical_pending: number;
  overdue_count: number;
};

function money(n: number) {
  const x = Math.max(0, Number(n || 0));
  return x.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

export default function RevenueAtRiskCard() {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [m, setM] = useState<Metrics | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const res = await fetch("/api/exec/metrics?days=30");
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error || "Failed");
        if (!mounted) return;
        setM(json.metrics);
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

  const trendMax = useMemo(() => {
    const vals = (m?.trend ?? []).map((t) => Number(t.revenue_at_risk || 0));
    return Math.max(1, ...vals);
  }, [m]);

  if (loading) {
    return (
      <div className="rounded-2xl border bg-white p-4">
        Loading executive metrics…
      </div>
    );
  }
  if (err || !m) {
    return (
      <div className="rounded-2xl border bg-white p-4 text-sm text-neutral-600">
        Failed to load: {err ?? "unknown"}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border bg-white p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-sm font-semibold">Revenue at Risk (last 30 days)</div>
          <div className="mt-1 text-3xl font-bold">{money(m.revenue_at_risk)}</div>
          <div className="mt-1 text-xs text-neutral-500">
            Calculated from unapproved changes since {m.since}
          </div>
        </div>

        <div className="flex gap-3">
          <div className="rounded-xl border bg-neutral-50 px-3 py-2">
            <div className="text-xs text-neutral-500">Critical pending</div>
            <div className="text-xl font-bold">{m.critical_pending}</div>
          </div>
          <div className="rounded-xl border bg-neutral-50 px-3 py-2">
            <div className="text-xs text-neutral-500">Overdue</div>
            <div className="text-xl font-bold">{m.overdue_count}</div>
          </div>
        </div>
      </div>

      {/* Trend (simple spark bars) */}
      <div className="mt-4">
        <div className="text-xs font-semibold text-neutral-700">Exposure trend</div>
        <div className="mt-2 flex items-end gap-1">
          {(m.trend ?? []).slice(-30).map((t) => {
            const v = Number(t.revenue_at_risk || 0);
            const h = Math.round((v / trendMax) * 40);
            return (
              <div key={t.day} className="flex flex-col items-center">
                <div
                  className="w-2 rounded-sm bg-neutral-300"
                  style={{ height: `${h}px` }}
                />
              </div>
            );
          })}
        </div>
        <div className="mt-1 text-[11px] text-neutral-500">
          Each bar = daily sum of (MRR affected × revenue risk score)
        </div>
      </div>

      {/* Surface breakdown */}
      <div className="mt-5">
        <div className="text-xs font-semibold text-neutral-700">
          Exposure by revenue surface
        </div>
        <div className="mt-2 grid gap-2">
          {(m.by_surface ?? []).slice(0, 8).map((s) => {
            const pct =
              m.revenue_at_risk > 0
                ? Number(s.revenue_at_risk) / Number(m.revenue_at_risk)
                : 0;
            return (
              <div
                key={s.revenue_surface}
                className="rounded-xl border bg-neutral-50 p-3"
              >
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold">{s.revenue_surface}</div>
                  <div className="text-sm font-bold">
                    {money(Number(s.revenue_at_risk || 0))}
                  </div>
                </div>
                <div className="mt-1 flex items-center justify-between text-xs text-neutral-500">
                  <div>{s.count} open change(s)</div>
                  <div>{Math.round(pct * 100)}%</div>
                </div>
                <div className="mt-2 h-2 w-full rounded-full bg-white">
                  <div
                    className="h-2 rounded-full bg-neutral-300"
                    style={{ width: `${Math.max(2, Math.round(pct * 100))}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
