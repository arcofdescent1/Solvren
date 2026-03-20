"use client";

/**
 * Phase 1 — Object coverage table (§13.4).
 */
import * as React from "react";

export type ObjectCoverageRow = {
  objectType: string;
  readEnabled: boolean;
  writeEnabled: boolean;
  eventEnabled: boolean;
  backfillComplete: boolean;
  lastSyncedAt: string | null;
};

export function IntegrationObjectCoverageTable({ coverage }: { coverage: ObjectCoverageRow[] }) {
  if (coverage.length === 0) {
    return (
      <p className="text-sm text-[var(--text-muted)]">No object coverage data yet. Run a sync to populate.</p>
    );
  }
  return (
    <div className="overflow-x-auto rounded-md border border-[var(--border)]">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[var(--border)] bg-[var(--bg-muted)]">
            <th className="px-4 py-2 text-left font-medium text-[var(--text)]">Object</th>
            <th className="px-4 py-2 text-left font-medium text-[var(--text)]">Read</th>
            <th className="px-4 py-2 text-left font-medium text-[var(--text)]">Write</th>
            <th className="px-4 py-2 text-left font-medium text-[var(--text)]">Events</th>
            <th className="px-4 py-2 text-left font-medium text-[var(--text)]">Backfill</th>
            <th className="px-4 py-2 text-left font-medium text-[var(--text)]">Last synced</th>
          </tr>
        </thead>
        <tbody>
          {coverage.map((row) => (
            <tr key={row.objectType} className="border-b border-[var(--border)] last:border-0">
              <td className="px-4 py-2 font-medium text-[var(--text)]">{row.objectType}</td>
              <td className="px-4 py-2">{row.readEnabled ? "✓" : "—"}</td>
              <td className="px-4 py-2">{row.writeEnabled ? "✓" : "—"}</td>
              <td className="px-4 py-2">{row.eventEnabled ? "✓" : "—"}</td>
              <td className="px-4 py-2">{row.backfillComplete ? "✓" : "—"}</td>
              <td className="px-4 py-2 text-[var(--text-muted)]">
                {row.lastSyncedAt ? new Date(row.lastSyncedAt).toLocaleString() : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
