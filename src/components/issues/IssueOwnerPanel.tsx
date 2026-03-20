import { Card, CardBody } from "@/ui";
import type { Issue } from "@/modules/issues";

export function IssueOwnerPanel({
  issue,
  ownerDisplay,
}: {
  issue: Issue;
  ownerDisplay?: string | null;
}) {
  const hasOwner = issue.owner_user_id ?? issue.owner_team_key;
  return (
    <Card>
      <CardBody>
        <h3 className="text-sm font-medium text-[var(--text-muted)] mb-2">Owner</h3>
        {!hasOwner ? (
          <p className="text-sm text-[var(--text-muted)]">Unassigned</p>
        ) : (
          <dl className="grid grid-cols-2 gap-2 text-sm">
            {issue.owner_user_id && (
              <>
                <dt>User</dt>
                <dd className="font-mono text-xs">{ownerDisplay ?? issue.owner_user_id.slice(0, 8)}</dd>
              </>
            )}
            {issue.owner_team_key && (
              <>
                <dt>Team</dt>
                <dd>{issue.owner_team_key}</dd>
              </>
            )}
            {issue.assigned_at && (
              <>
                <dt>Assigned</dt>
                <dd>{new Date(issue.assigned_at).toLocaleString()}</dd>
              </>
            )}
          </dl>
        )}
      </CardBody>
    </Card>
  );
}
