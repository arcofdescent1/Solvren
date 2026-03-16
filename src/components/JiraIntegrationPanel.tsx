"use client";

import { Button } from "@/ui";
import Link from "next/link";

type Props = {
  orgId: string;
  jiraConnected: boolean;
  jiraConfig?: { siteName?: string; siteUrl?: string; projects?: string[] } | null;
  isAdmin: boolean;
};

export default function JiraIntegrationPanel({
  jiraConnected,
  jiraConfig,
  isAdmin,
}: Props) {
  const siteLabel = (jiraConfig as { siteUrl?: string })?.siteUrl
    ?? (jiraConfig as { siteName?: string })?.siteName
    ?? "Jira Cloud";
  const projects = (jiraConfig as { projects?: string[] })?.projects ?? [];
  const configComplete = jiraConnected && Array.isArray(projects) && projects.length > 0;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-[var(--text)]">Jira</h3>
        {jiraConnected ? (
          <span className="rounded-full bg-[var(--success)]/15 px-2.5 py-0.5 text-xs font-medium text-[var(--success)]">
            Connected · {siteLabel}
          </span>
        ) : (
          <span className="rounded-full border border-[var(--border)] px-2.5 py-0.5 text-xs text-[var(--text-muted)]">
            Not connected
          </span>
        )}
      </div>
      <p className="text-sm text-[var(--text-muted)]">
        Connect Jira Cloud to create Solvren changes from Jira issues, sync status, and display governance status in Jira.
      </p>
      {isAdmin && (
        <div className="flex items-center gap-2">
          <Link href="/org/settings/integrations/jira">
            <Button
              variant={jiraConnected && !configComplete ? "default" : "outline"}
              className={!jiraConnected ? "bg-[#0052CC] text-white hover:bg-[#0747A6]" : ""}
            >
              {!jiraConnected
                ? "Connect Jira"
                : configComplete
                  ? "Configure Jira"
                  : "Finish configuration"}
            </Button>
          </Link>
        </div>
      )}
    </div>
  );
}
