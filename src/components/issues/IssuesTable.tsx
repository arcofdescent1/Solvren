import Link from "next/link";
import type { Issue } from "@/modules/issues";
import { IssueRowNextAction } from "./IssueRowNextAction";
import { IssueSeverityBadge } from "./IssueSeverityBadge";
import { IssueSourceBadge } from "./IssueSourceBadge";
import { IssueStatusBadge } from "./IssueStatusBadge";
import { IssueVerificationBadge } from "./IssueVerificationBadge";

export function IssuesTable({ issues }: { issues: Issue[] }) {
  if (issues.length === 0) {
    return (
      <p className="py-8 text-center text-[var(--text-muted)]">
        No problems match the current filters. Try changing filters or status tab.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[var(--border)]">
            <th className="text-left py-2 pr-4 font-medium">Problem</th>
            <th className="text-left py-2 pr-4 font-medium">Where found</th>
            <th className="text-left py-2 pr-4 font-medium">Business area</th>
            <th className="text-left py-2 pr-4 font-medium">Impact</th>
            <th className="text-left py-2 pr-4 font-medium">Status</th>
            <th className="text-left py-2 pr-4 font-medium">Proof</th>
            <th className="text-left py-2 pr-4 font-medium">Next step</th>
          </tr>
        </thead>
        <tbody>
          {issues.map((i) => (
            <tr key={i.id} className="border-b border-[var(--border)] hover:bg-[var(--bg-surface-2)]/50">
              <td className="py-2 pr-4 max-w-[260px]">
                <Link
                  href={`/issues/${i.id}`}
                  className="font-semibold text-[var(--primary)] hover:underline"
                >
                  {i.title}
                </Link>
                <p className="mt-1 text-xs text-[var(--text-muted)]">{i.issue_key}</p>
              </td>
              <td className="py-2 pr-4">
                <IssueSourceBadge sourceType={i.source_type} />
              </td>
              <td className="py-2 pr-4">{i.domain_key}</td>
              <td className="py-2 pr-4">
                <IssueSeverityBadge severity={i.severity} />
              </td>
              <td className="py-2 pr-4">
                <IssueStatusBadge status={i.status} />
              </td>
              <td className="py-2 pr-4">
                <IssueVerificationBadge status={i.verification_status} />
              </td>
              <td className="py-2 pr-4 align-top">
                <IssueRowNextAction issue={i as Issue & { approval_state?: string | null }} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
