"use client";;
import { NativeSelect, Table } from "@/ui";

import { useEffect, useState } from "react";

function pct(n: number) {
  return `${Math.round(n * 100)}%`;
}
function pct1(n: number) {
  return `${(n * 100).toFixed(1)}%`;
}
function signedPct(n: number) {
  return `${n >= 0 ? "+" : ""}${Math.round(n * 100)}%`;
}
function money(n: number) {
  const v = Number(n || 0);
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(v);
  } catch {
    return `$${Math.round(v).toLocaleString()}`;
  }
}

const WINDOW_OPTIONS = [30, 90, 180] as const;

export function SignalCorrelationPanel() {
  const [windowDays, setWindowDays] = useState<number>(90);
  const [rows, setRows] = useState<
    {
      signal_key: string;
      total_changes?: number;
      incident_changes?: number;
      incident_rate?: number;
      incident_revenue_at_risk?: number;
      incident_realized_mrr?: number;
      incident_realized_revenue?: number;
      revenue_incident_rate?: number;
      mitigation_effectiveness?: number;
      mitigations_applied_count?: number;
      mitigations_total_suggested?: number;
      learned_multiplier?: number;
      learned_multiplier_reason?: Record<string, unknown>;
      bayes_mean?: number;
      bayes_ci_low?: number;
      bayes_ci_high?: number;
      bayes_confidence?: number;
      mitigation_lift?: number;
      mitigation_ci_low?: number;
      mitigation_ci_high?: number;
    }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const res = await fetch(
          `/api/risk/signal-correlation?domain=REVENUE&windowDays=${windowDays}`
        );
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error || "Failed to load signal correlation");
        if (mounted) setRows(json.rows ?? []);
      } catch (e: unknown) {
        if (mounted) setErr(e instanceof Error ? e.message : "Failed");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [windowDays]);

  return (
    <div className="rounded-2xl border p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-lg font-semibold">Signal Correlation (Revenue-weighted)</div>
          <div className="text-sm text-neutral-600">
            &quot;Signals like this historically caused incidents and impacted revenue.&quot;
          </div>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-neutral-600">Window:</label>
          <NativeSelect
            className="rounded border bg-white px-2 py-1 text-sm"
            value={windowDays}
            onChange={(e) => setWindowDays(Number(e.target.value))}
          >
            {WINDOW_OPTIONS.map((d) => (
              <option key={d} value={d}>
                Last {d} days
              </option>
            ))}
          </NativeSelect>
        </div>
      </div>
      {loading ? <div className="mt-3 text-sm text-neutral-600">Loading…</div> : null}
      {err ? <div className="mt-3 text-sm text-red-600">{err}</div> : null}
      {!loading && !err ? (
        <div className="mt-3 overflow-auto rounded-xl border">
          <Table className="min-w-[1000px] w-full text-sm">
            <thead className="bg-neutral-50">
              <tr className="text-left">
                <th className="p-3">Signal</th>
                <th className="p-3">Samples</th>
                <th className="p-3">Predicted incident probability</th>
                <th className="p-3">Confidence</th>
                <th className="p-3">Incident rate</th>
                <th className="p-3">Incident $ impact</th>
                <th className="p-3">Realized MRR</th>
                <th className="p-3">Revenue incident rate</th>
                <th className="p-3">Mitigation lift</th>
                <th className="p-3">Mitigation effectiveness</th>
                <th className="p-3">Learned multiplier</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.signal_key} className="border-t">
                  <td className="p-3 font-semibold">{r.signal_key}</td>
                  <td className="p-3">{r.total_changes}</td>
                  <td className="p-3">
                    <div className="font-semibold">
                      {pct1(Number(r.bayes_mean ?? 0))}{" "}
                      <span className="text-xs text-neutral-500">
                        (90% CI {pct1(Number(r.bayes_ci_low ?? 0))}–{pct1(Number(r.bayes_ci_high ?? 0))})
                      </span>
                    </div>
                  </td>
                  <td className="p-3">
                    <div>{Math.round((Number(r.bayes_confidence ?? 0)) * 100)}%</div>
                  </td>
                  <td className="p-3">{pct(Number(r.incident_rate || 0))}</td>
                  <td className="p-3">{money(Number(r.incident_revenue_at_risk || 0))}</td>
                  <td className="p-3">{money(Number(r.incident_realized_mrr || 0))}</td>
                  <td className="p-3">{pct(Number(r.revenue_incident_rate || 0))}</td>
                  <td className="p-3">
                    <div
                      className={`font-semibold ${
                        Number(r.mitigation_lift ?? 0) < 0 ? "text-emerald-700" : "text-amber-700"
                      }`}
                    >
                      {signedPct(Number(r.mitigation_lift ?? 0))}
                      <span className="text-xs text-neutral-500">
                        {" "}(CI {signedPct(Number(r.mitigation_ci_low ?? 0))}–{signedPct(Number(r.mitigation_ci_high ?? 0))})
                      </span>
                    </div>
                    <div className="text-xs text-neutral-500">negative = mitigations help</div>
                  </td>
                  <td className="p-3">
                    {pct(Number(r.mitigation_effectiveness ?? 0))}
                    {(r.mitigations_applied_count ?? 0) > 0 && (
                      <span className="ml-1 text-neutral-500">
                        ({r.mitigations_applied_count}/{r.mitigations_total_suggested ?? 0})
                      </span>
                    )}
                  </td>
                  <td className="p-3">
                    <details>
                      <summary className="cursor-pointer select-none font-semibold">
                        {Number(r.learned_multiplier ?? 1).toFixed(2)}×
                      </summary>
                      <pre className="mt-2 overflow-auto rounded-lg border bg-white p-2 text-xs">
                        {JSON.stringify(r.learned_multiplier_reason ?? {}, null, 2)}
                      </pre>
                    </details>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      ) : null}
    </div>
  );
}
