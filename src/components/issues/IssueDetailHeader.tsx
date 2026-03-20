import Link from "next/link";
import type { Issue } from "@/modules/issues";
import { IssueSeverityBadge } from "./IssueSeverityBadge";
import { IssueSourceBadge } from "./IssueSourceBadge";
import { IssueStatusBadge } from "./IssueStatusBadge";
import { IssueVerificationBadge } from "./IssueVerificationBadge";
import { IssuePriorityBadge } from "./IssuePriorityBadge";

export function IssueDetailHeader({ issue }: { issue: Issue }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
        <Link href="/issues" className="hover:text-[var(--primary)]">
          Issues
        </Link>
        <span>/</span>
        <span className="font-mono">{issue.issue_key}</span>
      </div>
      <h1 className="text-xl font-semibold text-[var(--text)]">{issue.title}</h1>
      {(issue.summary ?? issue.description) && (
        <p className="text-sm text-[var(--text-muted)] line-clamp-2">
          {issue.summary ?? issue.description}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <IssueStatusBadge status={issue.status} />
        <IssueVerificationBadge status={issue.verification_status} />
        <IssueSeverityBadge severity={issue.severity} />
        <IssueSourceBadge sourceType={issue.source_type} />
        <IssuePriorityBadge score={issue.priority_score} />
        {issue.domain_key && (
          <span className="rounded border border-[var(--border)] px-1.5 py-0.5 text-xs">
            {issue.domain_key}
          </span>
        )}
      </div>
    </div>
  );
}
