import Link from "next/link";
import type { Issue } from "@/modules/issues";
import { IssueSeverityBadge } from "./IssueSeverityBadge";
import { IssueSourceBadge } from "./IssueSourceBadge";
import { IssueStatusBadge } from "./IssueStatusBadge";
import { IssueVerificationBadge } from "./IssueVerificationBadge";
import { IssuePriorityBadge } from "./IssuePriorityBadge";

export function IssuesTable({ issues }: { issues: Issue[] }) {
  if (issues.length === 0) {
    return (
      <p className="py-8 text-center text-[var(--text-muted)]">
        No issues match the current filters. Try changing filters or status tab.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[var(--border)]">
            <th className="text-left py-2 pr-4 font-medium">Key</th>
            <th className="text-left py-2 pr-4 font-medium">Title</th>
            <th className="text-left py-2 pr-4 font-medium">Source</th>
            <th className="text-left py-2 pr-4 font-medium">Domain</th>
            <th className="text-left py-2 pr-4 font-medium">Severity</th>
            <th className="text-left py-2 pr-4 font-medium">Priority</th>
            <th className="text-left py-2 pr-4 font-medium">Status</th>
            <th className="text-left py-2 pr-4 font-medium">Verification</th>
          </tr>
        </thead>
        <tbody>
          {issues.map((i) => (
            <tr key={i.id} className="border-b border-[var(--border)] hover:bg-[var(--bg-surface-2)]/50">
              <td className="py-2 pr-4">
                <Link
                  href={`/issues/${i.id}`}
                  className="font-mono text-[var(--primary)] hover:underline"
                >
                  {i.issue_key}
                </Link>
              </td>
              <td className="py-2 pr-4 max-w-[200px] truncate" title={i.title}>
                {i.title}
              </td>
              <td className="py-2 pr-4">
                <IssueSourceBadge sourceType={i.source_type} />
              </td>
              <td className="py-2 pr-4">{i.domain_key}</td>
              <td className="py-2 pr-4">
                <IssueSeverityBadge severity={i.severity} />
              </td>
              <td className="py-2 pr-4">
                <IssuePriorityBadge score={i.priority_score} />
              </td>
              <td className="py-2 pr-4">
                <IssueStatusBadge status={i.status} />
              </td>
              <td className="py-2 pr-4">
                <IssueVerificationBadge status={i.verification_status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
