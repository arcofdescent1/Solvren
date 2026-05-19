"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Table } from "@/ui";

type Driver = {
  id: string;
  title: string | null;
  status: string | null;
  revenue_surface: string;
  estimated_mrr_affected: number;
  revenue_risk_score: number;
  revenue_at_risk: number;
  submitted_at: string | null;
  due_at: string | null;
};

function money(n: number) {
  const x = Math.max(0, Number(n || 0));
  return x.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

function pct0(n: number) {
  const x = Number(n || 0);
  return `${Math.round(x * 100)}%`;
}

export default function TopDriversTable() {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [drivers, setDrivers] = useState<Driver[]>([]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const res = await fetch("/api/exec/drivers?days=30&limit=10");
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error || "Exposure drivers could not be loaded.");
        if (!mounted) return;
        setDrivers((json.drivers ?? []) as Driver[]);
      } catch (e: unknown) {
        if (!mounted) return;
        setErr(e instanceof Error ? e.message : "Exposure drivers could not be loaded.");
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
    <div className="mt-4 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--bg-surface)] p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold">Top exposure drivers</div>
        <div className="text-xs text-[var(--text-muted)]">Last 30 days - open changes</div>
      </div>
      {loading ? (
        <div className="mt-3 text-sm text-[var(--text-muted)]">Loading...</div>
      ) : err ? (
        <div className="mt-3 text-sm text-[var(--text-muted)]">{err}</div>
      ) : drivers.length === 0 ? (
        <div className="mt-3 text-sm text-[var(--text-muted)]">No open exposure drivers in the last 30 days.</div>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <Table className="w-full text-sm">
            <thead className="text-left text-xs text-[var(--text-muted)]">
              <tr>
                <th className="py-2 pr-3">Change</th>
                <th className="py-2 pr-3">Revenue surface</th>
                <th className="py-2 pr-3">MRR affected</th>
                <th className="py-2 pr-3">Review level</th>
                <th className="py-2 pr-3">Revenue at risk</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2 pr-3">Due</th>
              </tr>
            </thead>
            <tbody>
              {drivers.map((d) => (
                <tr key={d.id} className="border-t border-[var(--border)]">
                  <td className="py-2 pr-3">
                    <Link href={`/changes/${d.id}`} className="font-semibold hover:underline">
                      {d.title ?? d.id.slice(0, 8)}
                    </Link>
                    <div className="text-xs text-[var(--text-muted)]">{d.id.slice(0, 8)}</div>
                  </td>
                  <td className="py-2 pr-3">{d.revenue_surface}</td>
                  <td className="py-2 pr-3">{money(d.estimated_mrr_affected)}</td>
                  <td className="py-2 pr-3">{pct0(d.revenue_risk_score)}</td>
                  <td className="py-2 pr-3 font-semibold">{money(d.revenue_at_risk)}</td>
                  <td className="py-2 pr-3">{d.status ?? "-"}</td>
                  <td className="py-2 pr-3">{d.due_at ? new Date(d.due_at).toLocaleDateString() : "-"}</td>
                </tr>
              ))}
            </tbody>
          </Table>
          <div className="mt-2 text-xs text-[var(--text-muted)]">
            Revenue at risk is estimated from affected recurring revenue and the current review level.
          </div>
        </div>
      )}
    </div>
  );
}
