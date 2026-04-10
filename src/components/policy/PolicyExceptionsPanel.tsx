"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardBody } from "@/ui";

type ExceptionRow = {
  id: string;
  status: string;
  reason: string;
  effective_from: string;
  effective_to: string | null;
  override_effect_json: Record<string, unknown>;
};

export function PolicyExceptionsPanel({
  policyId,
  orgId: _orgId,
  exceptions,
}: {
  policyId: string;
  orgId: string;
  exceptions: ExceptionRow[];
}) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [reason, setReason] = useState("");
  const [effectiveFrom, setEffectiveFrom] = useState("");
  const [effectiveTo, setEffectiveTo] = useState("");

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim() || !effectiveFrom) return;
    setCreating(true);
    try {
      const res = await fetch(`/api/admin/policies/${policyId}/exceptions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reason: reason.trim(),
          effectiveFrom,
          effectiveTo: effectiveTo || null,
          overrideEffect: { disposition: "ALLOW" },
        }),
      });
      if (res.ok) {
        router.refresh();
        setReason("");
        setEffectiveFrom("");
        setEffectiveTo("");
      } else {
        const json = await res.json();
        alert(json.error ?? "Failed to create exception");
      }
    } finally {
      setCreating(false);
    }
  };

  const handleDeactivate = async (id: string) => {
    const res = await fetch(`/api/admin/policy-exceptions/${id}/deactivate`, { method: "POST" });
    if (res.ok) router.refresh();
    else alert((await res.json()).error ?? "Failed");
  };

  const active = exceptions.filter((e) => e.status === "active");

  return (
    <div className="space-y-4">
      <Card>
        <CardBody>
          <h3 className="text-sm font-medium text-[var(--text-muted)] mb-3">Create exception</h3>
          <form onSubmit={handleCreate} className="space-y-2">
            <div>
              <label className="block text-xs text-[var(--text-muted)] mb-1">Reason</label>
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Temporary override for…"
                className="w-full rounded border border-[var(--border)] px-3 py-2 text-sm"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs text-[var(--text-muted)] mb-1">Effective from</label>
                <input
                  type="datetime-local"
                  value={effectiveFrom}
                  onChange={(e) => setEffectiveFrom(e.target.value)}
                  className="w-full rounded border border-[var(--border)] px-3 py-2 text-sm"
                  required
                />
              </div>
              <div>
                <label className="block text-xs text-[var(--text-muted)] mb-1">Effective to (optional)</label>
                <input
                  type="datetime-local"
                  value={effectiveTo}
                  onChange={(e) => setEffectiveTo(e.target.value)}
                  className="w-full rounded border border-[var(--border)] px-3 py-2 text-sm"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={creating}
              className="rounded bg-[var(--primary)] px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              {creating ? "Creating…" : "Create exception"}
            </button>
          </form>
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          <h3 className="text-sm font-medium text-[var(--text-muted)] mb-2">Active exceptions</h3>
          {active.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)]">No active exceptions.</p>
          ) : (
            <ul className="space-y-2">
              {active.map((e) => (
                <li key={e.id} className="flex items-center justify-between rounded border border-[var(--border)] px-3 py-2 text-sm">
                  <div>
                    <p>{e.reason}</p>
                    <p className="text-xs text-[var(--text-muted)]">
                      {new Date(e.effective_from).toLocaleString()} – {e.effective_to ? new Date(e.effective_to).toLocaleString() : "No end"}
                    </p>
                  </div>
                  <button
                    onClick={() => handleDeactivate(e.id)}
                    className="rounded px-2 py-1 text-xs border border-[var(--border)] hover:bg-[var(--bg-surface-2)]"
                  >
                    Deactivate
                  </button>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
