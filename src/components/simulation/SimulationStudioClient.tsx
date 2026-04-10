"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardBody } from "@/ui";

const SIMULATION_TYPES = [
  { value: "PLAYBOOK_BACKTEST", label: "Playbook backtest" },
  { value: "POLICY_PREVIEW", label: "Policy preview" },
  { value: "THRESHOLD_COMPARISON", label: "Threshold comparison" },
  { value: "WORKFLOW_REPLAY", label: "Workflow replay" },
  { value: "DEMO_SCENARIO", label: "Demo scenario" },
];

const AUTONOMY_MODES = [
  { value: "manual_only", label: "Manual only" },
  { value: "approve_then_execute", label: "Approve then execute" },
  { value: "auto_execute_low_risk", label: "Auto execute (low risk)" },
  { value: "auto_execute_policy_bounded", label: "Auto execute (policy bounded)" },
];

export function SimulationStudioClient({ orgId: _orgId }: { orgId: string }) {
  const [simulations, setSimulations] = useState<unknown[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    simulationType: "PLAYBOOK_BACKTEST",
    historicalDays: 30,
    playbookKey: "failed_payment_recovery",
    autonomyMode: "approve_then_execute",
    maxAutoRetryAmount: 10000,
  });

  const fetchSimulations = () => {
    fetch("/api/admin/simulations")
      .then((r) => r.json())
      .then((d) => setSimulations(d.simulations ?? []))
      .catch(() => setSimulations([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchSimulations();
  }, []);

  const runSimulation = async () => {
    setRunning(true);
    setError(null);
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - form.historicalDays);

    const res = await fetch("/api/admin/simulations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        simulationType: form.simulationType,
        historicalWindowStart: start.toISOString(),
        historicalWindowEnd: end.toISOString(),
        scope: {
          playbookKey: form.playbookKey,
          issueFamily: "revenue_leakage",
        },
        config: {
          playbookKey: form.playbookKey,
          autonomyMode: form.autonomyMode,
          policyOverrides: { maxAutoRetryAmount: form.maxAutoRetryAmount },
        },
      }),
    });
    const json = await res.json();
    setRunning(false);
    if (!res.ok) {
      setError(json.error ?? "Failed to create simulation");
      return;
    }
    fetchSimulations();
    const runId = json.simulationRunId;
    if (runId) {
      await fetch("/api/admin/simulations/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ runId }),
      });
      fetchSimulations();
      window.location.href = `/admin/simulation/${runId}`;
    }
  };

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card>
        <CardBody>
          <h3 className="text-sm font-medium text-[var(--text-muted)] mb-3">Create simulation</h3>
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-[var(--text-muted)] mb-1">Simulation type</label>
              <select
                value={form.simulationType}
                onChange={(e) => setForm((f) => ({ ...f, simulationType: e.target.value }))}
                className="w-full rounded border border-[var(--border)] bg-[var(--bg)] px-2 py-1.5 text-sm"
              >
                {SIMULATION_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            {form.simulationType !== "DEMO_SCENARIO" && (
              <div>
                <label className="block text-xs text-[var(--text-muted)] mb-1">Historical window (days)</label>
                <input
                  type="number"
                  min={1}
                  max={365}
                  value={form.historicalDays}
                  onChange={(e) => setForm((f) => ({ ...f, historicalDays: parseInt(e.target.value, 10) || 30 }))}
                  className="w-full rounded border border-[var(--border)] bg-[var(--bg)] px-2 py-1.5 text-sm"
                />
              </div>
            )}
            <div>
              <label className="block text-xs text-[var(--text-muted)] mb-1">Playbook</label>
              <input
                type="text"
                value={form.playbookKey}
                onChange={(e) => setForm((f) => ({ ...f, playbookKey: e.target.value }))}
                placeholder="failed_payment_recovery"
                className="w-full rounded border border-[var(--border)] bg-[var(--bg)] px-2 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-[var(--text-muted)] mb-1">Autonomy mode</label>
              <select
                value={form.autonomyMode}
                onChange={(e) => setForm((f) => ({ ...f, autonomyMode: e.target.value }))}
                className="w-full rounded border border-[var(--border)] bg-[var(--bg)] px-2 py-1.5 text-sm"
              >
                {AUTONOMY_MODES.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-[var(--text-muted)] mb-1">Max auto-retry amount ($)</label>
              <input
                type="number"
                value={form.maxAutoRetryAmount}
                onChange={(e) => setForm((f) => ({ ...f, maxAutoRetryAmount: parseInt(e.target.value, 10) || 10000 }))}
                className="w-full rounded border border-[var(--border)] bg-[var(--bg)] px-2 py-1.5 text-sm"
              />
            </div>
          </div>
          {error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}
          <button
            onClick={runSimulation}
            disabled={running}
            className="mt-4 w-full rounded bg-[var(--primary)] px-3 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            {running ? "Running…" : "Run simulation"}
          </button>
        </CardBody>
      </Card>
      <Card>
        <CardBody>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-[var(--text-muted)]">Recent runs</h3>
            <Link href="/admin/simulation/compare" className="text-xs font-medium text-[var(--primary)] hover:underline">
              Compare
            </Link>
          </div>
          {loading ? (
            <p className="text-sm text-[var(--text-muted)]">Loading…</p>
          ) : (simulations as { id: string; status: string; simulation_type: string; created_at: string }[]).length === 0 ? (
            <p className="text-sm text-[var(--text-muted)]">No simulations yet.</p>
          ) : (
            <ul className="space-y-2">
              {(simulations as { id: string; status: string; simulation_type: string; created_at: string }[]).slice(0, 10).map((s) => (
                <li key={s.id} className="flex items-center justify-between text-sm">
                  <Link href={`/admin/simulation/${s.id}`} className="text-[var(--primary)] hover:underline">
                    {s.simulation_type} — {s.status}
                  </Link>
                  <span className="text-[var(--text-muted)]">
                    {new Date(s.created_at).toLocaleDateString()}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
