"use client";

import { Button } from "@/ui";
import Link from "next/link";

type Props = {
  orgId: string;
  salesforceConnected: boolean;
  sfOrgId: string | null;
  isAdmin: boolean;
};

export default function SalesforceIntegrationPanel({ salesforceConnected, sfOrgId, isAdmin }: Props) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-[var(--text)]">Salesforce</h3>
        {salesforceConnected ? (
          <span className="rounded-full bg-[var(--success)]/15 px-2.5 py-0.5 text-xs font-medium text-[var(--success)]">Connected · {sfOrgId ?? "Salesforce"}</span>
        ) : (
          <span className="rounded-full border border-[var(--border)] px-2.5 py-0.5 text-xs text-[var(--text-muted)]">Not connected</span>
        )}
      </div>
      <div className="text-xs opacity-70">
        Connect Salesforce to detect revenue-impacting CRM changes, link records to governance, and validate lead routing and pricing metadata.
      </div>
      {isAdmin && (
        <div className="flex gap-2">
          <Link href="/org/settings/integrations/salesforce">
            <Button variant={salesforceConnected ? "outline" : "default"}>
              {salesforceConnected ? "Configure Salesforce" : "Connect Salesforce"}
            </Button>
          </Link>
        </div>
      )}
    </div>
  );
}
