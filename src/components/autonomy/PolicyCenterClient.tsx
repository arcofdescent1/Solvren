"use client";

import { useEffect, useState } from "react";
import { Card, CardBody } from "@/ui";

export function PolicyCenterClient({ orgId }: { orgId: string }) {
  const [policies, setPolicies] = useState<unknown[]>([]);
  const [paused, setPaused] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/autonomy/policies")
      .then((r) => r.json())
      .then((d) => setPolicies(d.policies ?? []))
      .finally(() => setLoading(false));
  }, []);

  const handlePause = async (pause: boolean) => {
    const res = await fetch("/api/admin/autonomy/policies/pause-all", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pause, reason: pause ? "Manual pause" : "Resumed" }),
    });
    if (res.ok) setPaused(pause);
  };

  if (loading) {
    return (
      <Card>
        <CardBody>
          <p className="text-sm text-[var(--text-muted)]">Loading policies…</p>
        </CardBody>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardBody>
          <h2 className="text-lg font-semibold">Automation controls</h2>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Pause all automation for this organization. Workflows will not start until resumed.
          </p>
          <button
            onClick={() => handlePause(!paused)}
            className={`mt-3 rounded px-3 py-1.5 text-sm font-medium ${paused ? "bg-[var(--success)]/20 text-[var(--success)]" : "bg-[var(--warning)]/20 text-[var(--warning)]"}`}
          >
            {paused ? "Resume automation" : "Pause all automation"}
          </button>
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          <h2 className="text-lg font-semibold">Policies</h2>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Org-scoped policies control which actions and playbooks are allowed.
          </p>
          {policies.length === 0 ? (
            <p className="mt-3 text-sm text-[var(--text-muted)]">
              No policies defined. Default approval-required mode applies. Add policies via API or Policy Builder (coming soon).
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {(policies as Array<{ policy_key: string; display_name: string; autonomy_mode: string }>).map((p) => (
                <li key={p.policy_key} className="flex items-center justify-between rounded border border-[var(--border)] px-3 py-2">
                  <span className="font-medium">{p.display_name}</span>
                  <span className="text-xs text-[var(--text-muted)]">{p.autonomy_mode}</span>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
