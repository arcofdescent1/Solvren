"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardBody } from "@/ui";

const SCOPES = ["global", "org", "environment", "action", "playbook", "issue_family", "integration", "risk_class"];
const DISPOSITIONS = ["ALLOW", "BLOCK", "REQUIRE_APPROVAL"];

export function PolicyCreateClient({ orgId: _orgId }: { orgId: string }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<{
    policyKey: string;
    displayName: string;
    description: string;
    scope: string;
    scopeRef: string;
    priorityOrder: number;
    status: string;
    defaultDisposition: "ALLOW" | "BLOCK" | "REQUIRE_APPROVAL";
    rules: unknown[];
  }>({
    policyKey: "",
    displayName: "",
    description: "",
    scope: "action",
    scopeRef: "",
    priorityOrder: 100,
    status: "active",
    defaultDisposition: "BLOCK",
    rules: [],
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/policies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          policyKey: form.policyKey,
          displayName: form.displayName,
          description: form.description,
          scope: form.scope,
          scopeRef: form.scopeRef || null,
          priorityOrder: form.priorityOrder,
          status: form.status,
          defaultDisposition: form.defaultDisposition,
          rules: form.rules,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error ?? "Failed to create policy");
        return;
      }
      router.push(`/admin/policy/${json.policy?.id ?? ""}`);
      router.refresh();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardBody>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs text-[var(--text-muted)] mb-1">Policy key</label>
            <input
              type="text"
              value={form.policyKey}
              onChange={(e) => setForm((f) => ({ ...f, policyKey: e.target.value }))}
              placeholder="failed_payment_retry_policy"
              className="w-full rounded border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm"
              required
            />
          </div>
          <div>
            <label className="block text-xs text-[var(--text-muted)] mb-1">Display name</label>
            <input
              type="text"
              value={form.displayName}
              onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))}
              placeholder="Failed Payment Retry Policy"
              className="w-full rounded border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm"
              required
            />
          </div>
          <div>
            <label className="block text-xs text-[var(--text-muted)] mb-1">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Controls retry automation for failed payments"
              className="w-full rounded border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm"
              rows={2}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-[var(--text-muted)] mb-1">Scope</label>
              <select
                value={form.scope}
                onChange={(e) => setForm((f) => ({ ...f, scope: e.target.value }))}
                className="w-full rounded border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm"
              >
                {SCOPES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-[var(--text-muted)] mb-1">Scope ref (e.g. stripe.retry_payment)</label>
              <input
                type="text"
                value={form.scopeRef}
                onChange={(e) => setForm((f) => ({ ...f, scopeRef: e.target.value }))}
                placeholder="stripe.retry_payment"
                className="w-full rounded border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-[var(--text-muted)] mb-1">Default disposition</label>
              <select
                value={form.defaultDisposition}
                onChange={(e) => setForm((f) => ({ ...f, defaultDisposition: e.target.value as "ALLOW" | "BLOCK" | "REQUIRE_APPROVAL" }))}
                className="w-full rounded border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm"
              >
                {DISPOSITIONS.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-[var(--text-muted)] mb-1">Priority order</label>
              <input
                type="number"
                value={form.priorityOrder}
                onChange={(e) => setForm((f) => ({ ...f, priorityOrder: parseInt(e.target.value, 10) || 100 }))}
                className="w-full rounded border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm"
              />
            </div>
          </div>
          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
          <button
            type="submit"
            disabled={saving}
            className="rounded bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            {saving ? "Creating…" : "Create policy"}
          </button>
        </form>
      </CardBody>
    </Card>
  );
}
