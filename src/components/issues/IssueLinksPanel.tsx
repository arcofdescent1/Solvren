import Link from "next/link";
import { Card, CardBody } from "@/ui";

type ChangeLink = { changeId: string; linkType: string; title?: string | null };
type EntityLink = {
  entityType: string;
  externalSystem?: string | null;
  externalId?: string | null;
  displayName?: string | null;
  entityId?: string | null;
  role?: string | null;
  confidence?: number;
};

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

  const primaryEntities = entities.filter((e) => e.role === "primary");
  const otherEntities = entities.filter((e) => e.role !== "primary");

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
            {primaryEntities.length > 0 && (
              <div className="mb-2">
                <p className="text-xs text-[var(--text-muted)] mb-1">Primary entity</p>
                <ul className="space-y-1 text-sm">
                  {primaryEntities.map((e, i) => (
                    <li
                      key={`primary-${e.entityId ?? e.externalId}-${i}`}
                      className="rounded bg-[var(--primary)]/5 border border-[var(--primary)]/20 px-2 py-1"
                    >
                      <span className="font-medium">{e.entityType}</span> —{" "}
                      {e.displayName ?? e.externalId ?? e.entityId?.slice(0, 8) ?? "—"}
                      {e.externalSystem && ` (${e.externalSystem})`}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {otherEntities.length > 0 && (
              <div>
                <p className="text-xs text-[var(--text-muted)] mb-1">Supporting entities</p>
                <ul className="space-y-1 text-sm">
                  {otherEntities.map((e, i) => (
                    <li key={`${e.entityId ?? e.externalSystem}-${e.externalId ?? i}`}>
                      {e.displayName ?? e.externalId ?? e.entityId?.slice(0, 8) ?? "—"} ({e.entityType}
                      {e.externalSystem ? `, ${e.externalSystem}` : ""})
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </CardBody>
    </Card>
  );
}
