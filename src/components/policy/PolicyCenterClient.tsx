"use client";

import Link from "next/link";
import { Card, CardBody } from "@/ui";

type PolicyRow = {
  id: string;
  policy_key: string;
  display_name: string;
  scope: string;
  status: string;
  default_disposition: string;
  priority_order: number;
};

type ApprovalRow = {
  id: string;
  issue_id: string | null;
  action_key: string | null;
  playbook_key: string | null;
  required_approval_count: number;
  requested_roles_json: string[];
  created_at: string;
};

type DecisionLogRow = {
  id: string;
  action_key: string | null;
  playbook_key: string | null;
  final_disposition: string;
  decision_reason_code: string;
  decision_message: string;
  created_at: string;
};

export function PolicyCenterClient({
  orgId,
  policies,
  pendingApprovals,
  decisionLogs,
}: {
  orgId: string;
  policies: PolicyRow[];
  pendingApprovals: ApprovalRow[];
  decisionLogs: DecisionLogRow[];
}) {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card>
        <CardBody>
          <h3 className="text-sm font-medium text-[var(--text-muted)] mb-3">Policies</h3>
          {policies.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)]">No policies yet.</p>
          ) : (
            <ul className="space-y-2">
              {policies.slice(0, 15).map((p) => (
                <li key={p.id} className="flex items-center justify-between text-sm">
                  <Link href={`/admin/policy/${p.id}`} className="text-[var(--primary)] hover:underline">
                    {p.display_name}
                  </Link>
                  <span className="rounded px-1.5 py-0.5 text-xs bg-[var(--bg-muted)]">
                    {p.scope} · {p.status}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <Link href="/admin/policy/new" className="mt-3 inline-block text-sm font-medium text-[var(--primary)] hover:underline">
            + Create policy
          </Link>
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          <h3 className="text-sm font-medium text-[var(--text-muted)] mb-3">Approval queue</h3>
          {pendingApprovals.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)]">No pending approvals.</p>
          ) : (
            <ul className="space-y-2">
              {pendingApprovals.slice(0, 10).map((a) => (
                <li key={a.id} className="flex items-center justify-between text-sm">
                  <span>
                    {a.action_key ?? a.playbook_key ?? "—"} · {a.required_approval_count} required
                  </span>
                  <Link href={`/admin/policy/approvals?focus=${a.id}`} className="text-[var(--primary)] hover:underline">
                    Resolve
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <Link href="/admin/policy/approvals" className="mt-3 inline-block text-sm font-medium text-[var(--primary)] hover:underline">
            View all →
          </Link>
        </CardBody>
      </Card>

      <Card className="md:col-span-2">
        <CardBody>
          <h3 className="text-sm font-medium text-[var(--text-muted)] mb-3">Recent decision logs</h3>
          {decisionLogs.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)]">No decisions yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)]">
                    <th className="text-left py-2">Action / Playbook</th>
                    <th className="text-left py-2">Disposition</th>
                    <th className="text-left py-2">Reason</th>
                    <th className="text-left py-2">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {decisionLogs.map((d) => (
                    <tr key={d.id} className="border-b border-[var(--border)]">
                      <td className="py-1.5">{d.action_key ?? d.playbook_key ?? "—"}</td>
                      <td className="py-1.5">
                        <span
                          className={
                            d.final_disposition === "BLOCK"
                              ? "text-red-600 dark:text-red-400"
                              : d.final_disposition === "REQUIRE_APPROVAL"
                                ? "text-amber-600 dark:text-amber-400"
                                : "text-green-600 dark:text-green-400"
                          }
                        >
                          {d.final_disposition}
                        </span>
                      </td>
                      <td className="py-1.5 text-[var(--text-muted)]">{d.decision_reason_code}</td>
                      <td className="py-1.5 text-[var(--text-muted)]">
                        {new Date(d.created_at).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
