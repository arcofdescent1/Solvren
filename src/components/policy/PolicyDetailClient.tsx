"use client";

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
  const rules = (policy.rules_json ?? []) as Array<{
    ruleKey?: string;
    description?: string;
    effect?: { type?: string; reasonCode?: string };
    hardBlock?: boolean;
  }>;

  return (
    <div className="space-y-4">
      <Card>
        <CardBody>
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
