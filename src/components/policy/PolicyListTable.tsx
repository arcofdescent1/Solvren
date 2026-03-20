/**
 * Phase 2 Gap 2 — Policy list table (§6.1).
 */
import Link from "next/link";

type PolicyRow = {
  id: string;
  policy_key: string;
  display_name: string;
  scope: string;
  scope_ref: string | null;
  status: string;
  priority_order: number;
  rules_json?: unknown[];
  effective_from?: string;
  effective_to?: string | null;
  updated_at: string;
};

function hasHardBlock(rules: unknown[]): boolean {
  return (rules as Array<{ hardBlock?: boolean; effect?: { type?: string } }>).some(
    (r) => r.hardBlock && r.effect?.type === "BLOCK"
  );
}

function hasApprovalRules(rules: unknown[]): boolean {
  return (rules as Array<{ effect?: { type?: string } }>).some((r) => r.effect?.type === "REQUIRE_APPROVAL");
}

export function PolicyListTable({ policies }: { policies: PolicyRow[] }) {
  if (policies.length === 0) {
    return (
      <div className="rounded border border-[var(--border)] p-6 text-center text-sm text-[var(--text-muted)]">
        No policies yet.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded border border-[var(--border)]">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[var(--border)] bg-[var(--bg-surface-2)]">
            <th className="text-left py-2 px-3 font-medium">Name</th>
            <th className="text-left py-2 px-3 font-medium">Scope</th>
            <th className="text-left py-2 px-3 font-medium">Status</th>
            <th className="text-left py-2 px-3 font-medium">Priority</th>
            <th className="text-left py-2 px-3 font-medium">Rules</th>
            <th className="text-left py-2 px-3 font-medium">Last modified</th>
            <th className="text-left py-2 px-3 font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {policies.map((p) => {
            const rules = (p.rules_json ?? []) as unknown[];
            return (
              <tr key={p.id} className="border-b border-[var(--border)] hover:bg-[var(--bg-surface-2)]/50">
                <td className="py-2 px-3">
                  <Link href={`/admin/policy/${p.id}`} className="font-medium text-[var(--primary)] hover:underline">
                    {p.display_name}
                  </Link>
                  <div className="text-xs text-[var(--text-muted)] font-mono">{p.policy_key}</div>
                </td>
                <td className="py-2 px-3">
                  {p.scope}
                  {p.scope_ref && <span className="text-[var(--text-muted)]"> · {p.scope_ref}</span>}
                </td>
                <td className="py-2 px-3">
                  <span
                    className={`rounded px-1.5 py-0.5 text-xs ${
                      p.status === "active"
                        ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300"
                        : p.status === "draft"
                          ? "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300"
                          : "bg-[var(--bg-muted)]"
                    }`}
                  >
                    {p.status}
                  </span>
                </td>
                <td className="py-2 px-3">{p.priority_order}</td>
                <td className="py-2 px-3">
                  <span className="text-[var(--text-muted)]">{rules.length}</span>
                  {hasHardBlock(rules) && (
                    <span className="ml-1 rounded bg-red-100 dark:bg-red-900/30 px-1 text-xs" title="Hard block">
                      ⛔
                    </span>
                  )}
                  {hasApprovalRules(rules) && (
                    <span className="ml-1 rounded bg-amber-100 dark:bg-amber-900/30 px-1 text-xs" title="Approval rules">
                      ✓
                    </span>
                  )}
                </td>
                <td className="py-2 px-3 text-[var(--text-muted)]">
                  {p.updated_at ? new Date(p.updated_at).toLocaleDateString() : "—"}
                </td>
                <td className="py-2 px-3">
                  <Link
                    href={`/admin/policy/${p.id}`}
                    className="text-[var(--primary)] hover:underline text-xs"
                  >
                    View
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
