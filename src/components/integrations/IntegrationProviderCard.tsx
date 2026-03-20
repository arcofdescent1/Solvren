/**
 * Phase 1 — Provider card for Integration Control Center list (§13.3).
 * Shows provider icon/name, category, status, last success/error, quick actions.
 */
"use client";

import Link from "next/link";
import { IntegrationHealthBadge } from "./IntegrationHealthBadge";
import type { ConnectorManifest } from "@/modules/integrations/contracts";
import type { IntegrationAccountStatus } from "@/modules/integrations/contracts/types";

export type IntegrationProviderCardProps = {
  manifest: ConnectorManifest;
  status: IntegrationAccountStatus | "not_installed";
  detailHref: string;
  setupHref: string;
  lastSuccessAt?: string | null;
  lastErrorAt?: string | null;
  environment?: string;
  isAdmin?: boolean;
};

function formatRelative(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  if (diff < 60e3) return "Just now";
  if (diff < 3600e3) return `${Math.floor(diff / 60e3)}m ago`;
  if (diff < 86400e3) return `${Math.floor(diff / 3600e3)}h ago`;
  return `${Math.floor(diff / 86400e3)}d ago`;
}

export function IntegrationProviderCard({
  manifest,
  status,
  detailHref,
  setupHref,
  lastSuccessAt,
  lastErrorAt,
  environment = "production",
  isAdmin = false,
}: IntegrationProviderCardProps) {
  const connected = status !== "not_installed" && status !== "disconnected";
  return (
    <div className="flex flex-col rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="font-semibold text-[var(--text)]">{manifest.displayName}</h3>
          <p className="mt-0.5 text-sm capitalize text-[var(--text-muted)]">{manifest.category}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {manifest.isTierOne && (
            <span className="rounded bg-[var(--primary)]/10 px-1.5 py-0.5 text-[10px] font-medium uppercase text-[var(--primary)]">
              Tier 1
            </span>
          )}
          <IntegrationHealthBadge status={status} />
        </div>
      </div>
      <p className="mt-2 line-clamp-2 text-sm text-[var(--text-muted)]">{manifest.description}</p>
      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-[var(--text-muted)]">
        <span>Env: {environment}</span>
        <span>Last success: {formatRelative(lastSuccessAt)}</span>
        {lastErrorAt && <span className="text-red-600 dark:text-red-400">Last error: {formatRelative(lastErrorAt)}</span>}
      </div>
      <div className="mt-4 flex items-center justify-between border-t border-[var(--border)] pt-3">
        <span className="text-xs text-[var(--text-muted)]">
          {manifest.capabilities.length} capabilities · {manifest.supportedObjectTypes.length} object types
        </span>
        <div className="flex gap-2">
          {isAdmin && (
            <>
              <Link
                href={connected ? detailHref : setupHref}
                className="text-sm font-medium text-[var(--primary)] hover:underline"
              >
                {connected ? "Open" : "Connect"}
              </Link>
              {connected && (
                <Link href={`${detailHref}#test`} className="text-sm text-[var(--text-muted)] hover:underline">
                  Test
                </Link>
              )}
            </>
          )}
          {!isAdmin && connected && (
            <Link href={detailHref} className="text-sm font-medium text-[var(--primary)] hover:underline">
              View
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
