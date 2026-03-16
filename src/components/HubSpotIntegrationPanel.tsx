"use client";

import { Button } from "@/ui";
import Link from "next/link";

type Props = {
  orgId: string;
  hubspotConnected: boolean;
  hubId: number | null;
  isAdmin: boolean;
};

export default function HubSpotIntegrationPanel({ hubspotConnected, hubId, isAdmin }: Props) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-[var(--text)]">HubSpot</h3>
        {hubspotConnected ? (
          <span className="rounded-full bg-[var(--success)]/15 px-2.5 py-0.5 text-xs font-medium text-[var(--success)]">Connected · {hubId ?? "HubSpot"}</span>
        ) : (
          <span className="rounded-full border border-[var(--border)] px-2.5 py-0.5 text-xs text-[var(--text-muted)]">Not connected</span>
        )}
      </div>
      <div className="text-xs opacity-70">
        Connect HubSpot to detect revenue-impacting CRM changes, link records to governance, and run validation.
      </div>
      {isAdmin && (
        <div className="flex gap-2">
          <Link href="/org/settings/integrations/hubspot">
            <Button variant={hubspotConnected ? "outline" : "default"}>
              {hubspotConnected ? "Configure HubSpot" : "Connect HubSpot"}
            </Button>
          </Link>
        </div>
      )}
    </div>
  );
}
