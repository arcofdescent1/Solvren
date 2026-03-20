"use client";

import { useState } from "react";
import { Card, CardBody } from "@/ui";

type ApprovalRow = {
  id: string;
  issue_id: string | null;
  action_key: string | null;
  playbook_key: string | null;
  required_approval_count: number;
  requested_roles_json: string[];
  created_at: string;
  request_payload_json: Record<string, unknown>;
};

export function ApprovalQueueClient({ approvals }: { approvals: ApprovalRow[] }) {
  const [resolving, setResolving] = useState<string | null>(null);

  const handleResolve = async (id: string, action: "approve" | "reject") => {
    setResolving(id);
    try {
      const res = await fetch(`/api/admin/approval-requests/${id}/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (res.ok) window.location.reload();
      else {
        const json = await res.json();
        alert(json?.error ?? "Failed");
      }
    } finally {
      setResolving(null);
    }
  };

  if (approvals.length === 0) {
    return (
      <Card>
        <CardBody>
          <p className="text-sm text-[var(--text-muted)]">No pending approval requests.</p>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card>
      <CardBody>
        <ul className="space-y-4">
          {approvals.map((a) => (
            <li key={a.id} className="border-b border-[var(--border)] pb-4 last:border-0 last:pb-0">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-medium">
                    {a.action_key ?? a.playbook_key ?? "—"}
                    {a.issue_id && (
                      <span className="ml-2 text-sm text-[var(--text-muted)]">
                        Issue: {a.issue_id.slice(0, 8)}…
                      </span>
                    )}
                  </p>
                  <p className="text-sm text-[var(--text-muted)] mt-1">
                    {a.required_approval_count} approval(s) required · Roles:{" "}
                    {(a.requested_roles_json ?? []).join(", ") || "any"}
                  </p>
                  <p className="text-xs text-[var(--text-muted)] mt-1">
                    {new Date(a.created_at).toLocaleString()}
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => handleResolve(a.id, "approve")}
                    disabled={!!resolving}
                    className="rounded bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
                  >
                    {resolving === a.id ? "…" : "Approve"}
                  </button>
                  <button
                    onClick={() => handleResolve(a.id, "reject")}
                    disabled={!!resolving}
                    className="rounded bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                  >
                    Reject
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </CardBody>
    </Card>
  );
}
