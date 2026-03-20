/**
 * Phase 2 — Entity profile card (§13). Summary and preferred attributes.
 */
import * as React from "react";

export type EntityProfileCardProps = {
  entityType: string;
  displayName: string | null;
  preferredAttributes: Record<string, unknown>;
  status: string;
  createdAt: string;
};

export function EntityProfileCard({ entityType, displayName, preferredAttributes, status, createdAt }: EntityProfileCardProps) {
  const attrs = Object.entries(preferredAttributes).filter(([, v]) => v != null && v !== "");
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-semibold capitalize text-[var(--text)]">{entityType}</h3>
          <p className="mt-0.5 text-sm text-[var(--text-muted)]">{displayName ?? "—"}</p>
        </div>
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${status === "active" ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300" : "bg-[var(--bg-muted)] text-[var(--text-muted)]"}`}>
          {status}
        </span>
      </div>
      {attrs.length > 0 && (
        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-3">
          {attrs.slice(0, 9).map(([key, value]) => (
            <React.Fragment key={key}>
              <dt className="text-[var(--text-muted)]">{key.replace(/_/g, " ")}</dt>
              <dd className="text-[var(--text)]">{typeof value === "object" ? JSON.stringify(value) : String(value)}</dd>
            </React.Fragment>
          ))}
        </dl>
      )}
      <p className="mt-3 text-xs text-[var(--text-muted)]">Created {new Date(createdAt).toLocaleString()}</p>
    </div>
  );
}
