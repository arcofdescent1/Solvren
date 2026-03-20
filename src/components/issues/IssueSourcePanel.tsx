import { Card, CardBody } from "@/ui";
import type { Issue } from "@/modules/issues";
import { IssueSourceBadge } from "./IssueSourceBadge";

export function IssueSourcePanel({
  issue,
  evidenceJson,
}: {
  issue: Issue;
  evidenceJson?: Record<string, unknown> | null;
}) {
  return (
    <Card>
      <CardBody>
        <h3 className="text-sm font-medium text-[var(--text-muted)] mb-2">Source</h3>
        <dl className="grid grid-cols-2 gap-2 text-sm">
          <dt>Type</dt>
          <dd>
            <IssueSourceBadge sourceType={issue.source_type} />
          </dd>
          <dt>Ref</dt>
          <dd className="font-mono text-xs break-all">{issue.source_ref}</dd>
          {issue.source_event_time && (
            <>
              <dt>Event time</dt>
              <dd>{new Date(issue.source_event_time).toLocaleString()}</dd>
            </>
          )}
        </dl>
        {evidenceJson && Object.keys(evidenceJson).length > 0 && (
          <div className="mt-2 pt-2 border-t border-[var(--border)]">
            <p className="text-xs text-[var(--text-muted)] mb-1">Evidence</p>
            <pre className="text-xs overflow-auto max-h-32 rounded bg-[var(--bg-surface-2)] p-2">
              {JSON.stringify(evidenceJson, null, 2)}
            </pre>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
