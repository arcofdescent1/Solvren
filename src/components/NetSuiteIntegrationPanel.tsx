"use client";

import { Button } from "@/ui";
import Link from "next/link";

type Props = {
  orgId: string;
  netsuiteConnected: boolean;
  accountId: string | null;
  isAdmin: boolean;
};

export default function NetSuiteIntegrationPanel({
  netsuiteConnected,
  accountId,
  isAdmin,
}: Props) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-[var(--text)]">NetSuite</h3>
        {netsuiteConnected ? (
          <span className="rounded-full bg-[var(--success)]/15 px-2.5 py-0.5 text-xs font-medium text-[var(--success)]">
            Connected · {accountId ?? "NetSuite"}
          </span>
        ) : (
          <span className="rounded-full border border-[var(--border)] px-2.5 py-0.5 text-xs text-[var(--text-muted)]">
            Not connected
          </span>
        )}
      </div>
      <div className="text-xs opacity-70">
        Connect NetSuite to validate the financial effect of revenue-impacting changes, run reconciliation, and detect discrepancies.
      </div>
      {isAdmin && (
        <div className="flex items-center gap-2">
          <Link href="/org/settings/integrations/netsuite">
            <Button variant={netsuiteConnected ? "outline" : "default"}>
              {netsuiteConnected ? "Configure NetSuite" : "Connect NetSuite"}
            </Button>
          </Link>
        </div>
      )}
    </div>
  );
}
