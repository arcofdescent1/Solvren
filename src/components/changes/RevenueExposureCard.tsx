"use client";;
import { Button, Input, NativeSelect } from "@/ui";

import { useMemo, useState } from "react";

type RevenueSurface =
  | "PRICING"
  | "BILLING"
  | "PAYMENTS"
  | "SUBSCRIPTIONS"
  | "ENTITLEMENTS"
  | "CHECKOUT"
  | "TAX"
  | "PROMOTIONS"
  | "INVOICING"
  | "OTHER";

const SURFACES: (RevenueSurface | "PLAN_LOGIC" | "SUBSCRIPTION")[] = [
  "PRICING", "BILLING", "PAYMENTS", "SUBSCRIPTION", "SUBSCRIPTIONS", "PLAN_LOGIC",
  "ENTITLEMENTS", "CHECKOUT", "TAX", "PROMOTIONS",
  "INVOICING", "OTHER",
];

function fmtMoney(n: number) {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(n);
  } catch {
    return `$${Math.round(n).toLocaleString()}`;
  }
}

export function RevenueExposureCard(props: {
  changeId: string;
  initial: {
    estimatedMrrAffected: number | null;
    percentCustomerBaseAffected: number | null;
    revenueSurface: string | null;
    revenue?: {
      exposureMultiplier?: number;
      explanation?: Record<string, unknown>;
      revenueAtRisk?: number;
    } | null;
  };
  onUpdated?: (next: unknown) => void;
}) {
  const [estimated, setEstimated] = useState<string>(
    props.initial.estimatedMrrAffected?.toString() ?? ""
  );
  const [pct, setPct] = useState<string>(
    props.initial.percentCustomerBaseAffected?.toString() ?? ""
  );
  const [surface, setSurface] = useState<string>(props.initial.revenueSurface ?? "");
  const [saving, setSaving] = useState(false);
  const [serverRevenue, setServerRevenue] = useState<{
    exposureMultiplier?: number;
    explanation?: Record<string, unknown>;
    revenueAtRisk?: number;
  } | null>(props.initial.revenue ?? null);
  const [err, setErr] = useState<string | null>(null);

  const exposureMultiplier =
    serverRevenue?.exposureMultiplier ?? props.initial.revenue?.exposureMultiplier ?? null;
  const explanation =
    serverRevenue?.explanation ?? props.initial.revenue?.explanation ?? null;
  const revenueAtRisk =
    serverRevenue?.revenueAtRisk ?? props.initial.revenue?.revenueAtRisk ?? null;

  const computedAtRisk = useMemo(() => {
    const m = Number(estimated);
    if (!Number.isFinite(m) || m <= 0) return null;
    return m;
  }, [estimated]);

  async function save() {
    setSaving(true);
    setErr(null);
    try {
      const body = {
        estimatedMrrAffected: estimated.trim() === "" ? null : Number(estimated),
        percentCustomerBaseAffected: pct.trim() === "" ? null : Number(pct),
        revenueSurface: surface.trim() === "" ? null : surface,
      };
      const res = await fetch(`/api/changes/${props.changeId}/revenue`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok)
        throw new Error((json as { error?: string }).error || "Failed to update revenue exposure");
      setServerRevenue(json.revenue);
      props.onUpdated?.(json.revenue);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-2xl border p-4 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-lg font-semibold">Revenue Exposure</div>
          <div className="text-sm text-neutral-600">
            Add money context so risk becomes executive-relevant.
          </div>
        </div>
        <Button
          onClick={save}
          disabled={saving}
          className="rounded-xl border px-3 py-2 text-sm font-medium hover:bg-neutral-50 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save"}
        </Button>
      </div>
      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
        <label className="text-sm">
          <div className="mb-1 font-medium">Estimated MRR affected</div>
          <Input
            value={estimated}
            onChange={(e) => setEstimated(e.target.value)}
            placeholder="e.g. 25000"
            className="w-full rounded-xl border px-3 py-2"
            inputMode="numeric"
          />
          <div className="mt-1 text-xs text-neutral-500">
            {computedAtRisk != null ? fmtMoney(computedAtRisk) : "—"}
          </div>
        </label>
        <label className="text-sm">
          <div className="mb-1 font-medium">% customer base affected</div>
          <Input
            value={pct}
            onChange={(e) => setPct(e.target.value)}
            placeholder="0–100"
            className="w-full rounded-xl border px-3 py-2"
            inputMode="decimal"
          />
          <div className="mt-1 text-xs text-neutral-500">Use rough estimate.</div>
        </label>
        <label className="text-sm">
          <div className="mb-1 font-medium">Revenue surface</div>
          <NativeSelect
            value={surface}
            onChange={(e) => setSurface(e.target.value)}
            className="w-full rounded-xl border px-3 py-2"
          >
            <option value="">Unspecified</option>
            {SURFACES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </NativeSelect>
          <div className="mt-1 text-xs text-neutral-500">Where this touches revenue.</div>
        </label>
      </div>
      <div className="mt-4 rounded-xl border bg-white p-3">
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold">Revenue at Risk</div>
          <div className="text-sm font-bold">
            {revenueAtRisk != null ? fmtMoney(revenueAtRisk) : "—"}
          </div>
        </div>
        <div className="mt-1 text-xs text-neutral-600">
          Computed as: estimated MRR affected × (risk score ÷ 100)
        </div>
      </div>
      <div className="mt-4 rounded-xl bg-neutral-50 p-3">
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold">Exposure Multiplier</div>
          <div className="text-sm font-semibold">
            {exposureMultiplier != null ? exposureMultiplier.toFixed(2) + "×" : "—"}
          </div>
        </div>
        <details className="mt-2 text-sm text-neutral-700">
          <summary className="cursor-pointer select-none text-sm font-medium">
            Why am I seeing this multiplier?
          </summary>
          <pre className="mt-2 overflow-auto rounded-lg border bg-white p-2 text-xs">
            {explanation
              ? JSON.stringify(explanation, null, 2)
              : "No explanation available yet. Save revenue exposure to compute."}
          </pre>
        </details>
      </div>
      {err ? <div className="mt-3 text-sm text-red-600">{err}</div> : null}
    </div>
  );
}
