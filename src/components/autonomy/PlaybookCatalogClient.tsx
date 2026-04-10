"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardBody } from "@/ui";

type Playbook = {
  id: string;
  playbook_key: string;
  display_name: string;
  description: string;
  issue_family: string;
  default_autonomy_mode: string;
  config?: { enabled: boolean; rollout_state: string } | null;
};

export function PlaybookCatalogClient({ orgId: _orgId }: { orgId: string }) {
  const [playbooks, setPlaybooks] = useState<Playbook[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/autonomy/playbooks")
      .then((r) => r.json())
      .then((d) => setPlaybooks(d.playbooks ?? []))
      .finally(() => setLoading(false));
  }, []);

  const handleEnable = async (playbookKey: string, enabled: boolean) => {
    await fetch(`/api/admin/autonomy/playbooks/${playbookKey}/config`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        enabled,
        rollout_state: enabled ? "approval_required" : "off",
      }),
    });
    setPlaybooks((prev) =>
      prev.map((p) =>
        p.playbook_key === playbookKey
          ? { ...p, config: { ...p.config, enabled, rollout_state: enabled ? "approval_required" : "off" } }
          : p
      )
    );
  };

  if (loading) {
    return (
      <Card>
        <CardBody>
          <p className="text-sm text-[var(--text-muted)]">Loading playbooks…</p>
        </CardBody>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {playbooks.map((p) => (
        <Card key={p.id}>
          <CardBody>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="font-semibold">{p.display_name}</h3>
                <p className="mt-1 text-sm text-[var(--text-muted)]">{p.description}</p>
                <p className="mt-1 text-xs text-[var(--text-muted)]">
                  Issue family: {p.issue_family} · Default mode: {p.default_autonomy_mode}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`rounded px-2 py-0.5 text-xs font-medium ${p.config?.enabled ? "bg-[var(--success)]/20 text-[var(--success)]" : "bg-[var(--bg-surface-2)] text-[var(--text-muted)]"}`}
                >
                  {p.config?.enabled ? p.config.rollout_state : "Off"}
                </span>
                <button
                  onClick={() => handleEnable(p.playbook_key, !p.config?.enabled)}
                  className="rounded px-2 py-1 text-xs font-medium text-[var(--primary)] hover:bg-[var(--primary)]/10"
                >
                  {p.config?.enabled ? "Disable" : "Enable"}
                </button>
              </div>
            </div>
            <Link
              href={`/admin/autonomy/playbooks/${p.playbook_key}`}
              className="mt-3 inline-block text-xs font-medium text-[var(--primary)] hover:underline"
            >
              View details →
            </Link>
          </CardBody>
        </Card>
      ))}
      {playbooks.length === 0 && (
        <Card>
          <CardBody>
            <p className="text-sm text-[var(--text-muted)]">No playbooks available. Run migration 155 to seed default playbooks.</p>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
