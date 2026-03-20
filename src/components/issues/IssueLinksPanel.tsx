import Link from "next/link";
import { Card, CardBody } from "@/ui";

type ChangeLink = { changeId: string; linkType: string; title?: string | null };
type EntityLink = { entityType: string; externalSystem: string; externalId: string; displayName?: string | null };

export function IssueLinksPanel({
  changes,
  entities,
}: {
  changes: ChangeLink[];
  entities: EntityLink[];
}) {
  const hasChanges = changes.length > 0;
  const hasEntities = entities.length > 0;
  if (!hasChanges && !hasEntities) {
    return (
      <Card>
        <CardBody>
          <h3 className="text-sm font-medium text-[var(--text-muted)] mb-2">Links</h3>
          <p className="text-sm text-[var(--text-muted)]">No linked changes or entities.</p>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card>
      <CardBody>
        <h3 className="text-sm font-medium text-[var(--text-muted)] mb-2">Links</h3>
        {hasChanges && (
          <div className="mb-3">
            <p className="text-xs text-[var(--text-muted)] mb-1">Changes</p>
            <ul className="space-y-1">
              {changes.map((c) => (
                <li key={`${c.changeId}-${c.linkType}`} className="flex items-center gap-2 text-sm">
                  <span className="rounded border border-[var(--border)] px-1 py-0.5 text-xs">
                    {c.linkType}
                  </span>
                  <Link href={`/changes/${c.changeId}`} className="text-[var(--primary)] hover:underline">
                    {c.title ?? c.changeId.slice(0, 8)}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
        {hasEntities && (
          <div>
            <p className="text-xs text-[var(--text-muted)] mb-1">Entities</p>
            <ul className="space-y-1 text-sm">
              {entities.map((e, i) => (
                <li key={`${e.externalSystem}-${e.externalId}-${i}`}>
                  {e.displayName ?? e.externalId} ({e.externalSystem})
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
