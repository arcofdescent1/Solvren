/**
 * Phase 2 — Entity links table (§13). Linked external records by provider.
 */
import * as React from "react";
import Link from "next/link";

export type EntityLinkItem = {
  id: string;
  provider: string;
  external_object_type: string;
  external_id: string;
  link_status: string;
  confidence_score: number;
  match_strategy: string;
  created_at: string;
};

export function EntityLinksTable({
  links,
  orgId,
  entityId,
  onUnlink,
}: {
  links: EntityLinkItem[];
  orgId: string;
  entityId: string;
  onUnlink?: (linkId: string) => void;
}) {
  if (links.length === 0) {
    return <p className="text-sm text-[var(--text-muted)]">No linked source records.</p>;
  }
  return (
    <div className="overflow-x-auto rounded-md border border-[var(--border)]">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[var(--border)] bg-[var(--bg-muted)]">
            <th className="px-4 py-2 text-left font-medium text-[var(--text)]">Provider</th>
            <th className="px-4 py-2 text-left font-medium text-[var(--text)]">Object type</th>
            <th className="px-4 py-2 text-left font-medium text-[var(--text)]">External ID</th>
            <th className="px-4 py-2 text-left font-medium text-[var(--text)]">Confidence</th>
            <th className="px-4 py-2 text-left font-medium text-[var(--text)]">Strategy</th>
            <th className="px-4 py-2 text-left font-medium text-[var(--text)]">Linked</th>
          </tr>
        </thead>
        <tbody>
          {links.map((link) => (
            <tr key={link.id} className="border-b border-[var(--border)] last:border-0">
              <td className="px-4 py-2 font-medium text-[var(--text)]">{link.provider}</td>
              <td className="px-4 py-2 text-[var(--text)]">{link.external_object_type}</td>
              <td className="px-4 py-2 font-mono text-xs text-[var(--text-muted)]">{link.external_id}</td>
              <td className="px-4 py-2 text-[var(--text)]">{(Number(link.confidence_score) * 100).toFixed(0)}%</td>
              <td className="px-4 py-2 text-[var(--text-muted)]">{link.match_strategy}</td>
              <td className="px-4 py-2 text-[var(--text-muted)]">{new Date(link.created_at).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
