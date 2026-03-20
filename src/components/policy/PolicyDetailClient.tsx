"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Card, CardBody } from "@/ui";

type PolicyRow = {
  id: string;
  policy_key: string;
  display_name: string;
  description: string;
  scope: string;
  scope_ref: string | null;
  status: string;
  default_disposition: string;
  priority_order: number;
  rules_json: unknown[];
  effective_from: string;
  effective_to: string | null;
};

export function PolicyDetailClient({ policy }: { policy: PolicyRow }) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);

  async function runAction(action: string, url: string) {
    setLoading(action);
    try {
      const res = await fetch(url, { method: "POST" });
      const json = await res.json();
      if (res.ok) router.refresh();
      else alert(json.error ?? `${action} failed`);
    } finally {
      setLoading(null);
    }
  }

  const rules = (policy.rules_json ?? []) as Array<{
    ruleKey?: string;
    description?: string;
    effect?: { type?: string; reasonCode?: string };
    hardBlock?: boolean;
  }>;

  const isSystemPolicy = (policy as { is_system_policy?: boolean }).is_system_policy;

  return (
    <div className="space-y-4">
      <Card>
        <CardBody>
          <div className="flex flex-wrap items-center gap-2 mb-3">
            {policy.status === "active" && (
              <button
                onClick={() => runAction("deactivate", `/api/admin/policies/${policy.id}/deactivate`)}
                disabled={!!loading}
                className="rounded px-2 py-1 text-xs font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 hover:opacity-80 disabled:opacity-50"
              >
                Deactivate
              </button>
            )}
            {(policy.status === "inactive" || policy.status === "draft") && (
              <button
                onClick={() => runAction("activate", `/api/admin/policies/${policy.id}/activate`)}
                disabled={!!loading}
                className="rounded px-2 py-1 text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 hover:opacity-80 disabled:opacity-50"
              >
                Activate
              </button>
            )}
            <button
              onClick={async () => {
                setLoading("duplicate");
                try {
                  const res = await fetch(`/api/admin/policies/${policy.id}/duplicate`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({}),
                  });
                  const json = await res.json();
                  if (res.ok && json.policy?.id) router.push(`/admin/policy/${json.policy.id}`);
                  else alert(json.error ?? "Duplicate failed");
                } finally {
                  setLoading(null);
                }
              }}
              disabled={!!loading}
              className="rounded px-2 py-1 text-xs font-medium border border-[var(--border)] hover:bg-[var(--bg-surface-2)] disabled:opacity-50"
            >
              Duplicate
            </button>
            {!isSystemPolicy && (
              <button
                onClick={() => runAction("archive", `/api/admin/policies/${policy.id}/archive`)}
                disabled={!!loading}
                className="rounded px-2 py-1 text-xs font-medium text-[var(--text-muted)] hover:bg-[var(--bg-surface-2)] disabled:opacity-50"
              >
                Archive
              </button>
            )}
            <Link
              href={`/admin/policy/${policy.id}/exceptions`}
              className="rounded px-2 py-1 text-xs font-medium text-[var(--primary)] hover:underline"
            >
              Exceptions
            </Link>
          </div>
          <h3 className="text-sm font-medium text-[var(--text-muted)] mb-2">Configuration</h3>
          <dl className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <dt className="text-[var(--text-muted)]">Key</dt>
              <dd className="font-mono">{policy.policy_key}</dd>
            </div>
            <div>
              <dt className="text-[var(--text-muted)]">Scope</dt>
              <dd>{policy.scope}{policy.scope_ref ? ` · ${policy.scope_ref}` : ""}</dd>
            </div>
            <div>
              <dt className="text-[var(--text-muted)]">Status</dt>
              <dd>{policy.status}</dd>
            </div>
            <div>
              <dt className="text-[var(--text-muted)]">Default disposition</dt>
              <dd>{policy.default_disposition}</dd>
            </div>
            <div>
              <dt className="text-[var(--text-muted)]">Priority</dt>
              <dd>{policy.priority_order}</dd>
            </div>
          </dl>
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          <h3 className="text-sm font-medium text-[var(--text-muted)] mb-2">Rules</h3>
          {rules.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)]">No rules defined.</p>
          ) : (
            <ul className="space-y-2">
              {rules.map((r, i) => (
                <li key={i} className="flex items-center justify-between text-sm border-b border-[var(--border)] pb-2">
                  <div>
                    <span className="font-mono">{r.ruleKey ?? "—"}</span>
                    {r.hardBlock && (
                      <span className="ml-2 rounded bg-red-100 dark:bg-red-900/30 px-1.5 py-0.5 text-xs text-red-700 dark:text-red-300">
                        Hard block
                      </span>
                    )}
                    {r.description && (
                      <p className="text-[var(--text-muted)] text-xs mt-0.5">{r.description}</p>
                    )}
                  </div>
                  <span className="rounded px-1.5 py-0.5 bg-[var(--bg-muted)]">
                    {r.effect?.type ?? "—"}
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
