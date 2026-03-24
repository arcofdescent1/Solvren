"use client";

import Link from "next/link";
import { Button } from "@/ui";

/**
 * Phase 2 — Shared setup actions across providers:
 * connect, objects/templates (mappings), test, activate.
 */
type Props = {
  orgId: string;
  provider: string;
  connected: boolean;
  onTest?: () => void;
  testing?: boolean;
  testLabel?: string;
};

export function IntegrationSetupActions({
  orgId,
  provider,
  connected,
  onTest,
  testing = false,
  testLabel = "Test connection",
}: Props) {
  if (!connected) return null;

  return (
    <div className="flex flex-wrap items-center gap-3 border-t border-[var(--border)] pt-3">
      <Link
        href={`/integrations/mappings?orgId=${encodeURIComponent(orgId)}`}
        className="text-sm font-medium text-[var(--primary)] hover:underline"
      >
        Configure mappings
      </Link>
      {onTest && (
        <Button variant="outline" size="sm" onClick={onTest} disabled={testing}>
          {testing ? "Testing…" : testLabel}
        </Button>
      )}
    </div>
  );
}
