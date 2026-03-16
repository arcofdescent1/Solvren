"use client";

import { Button } from "@/ui";
import Link from "next/link";

type Props = {
  orgId: string;
  slackConnected: boolean;
  teamName: string | null;
  isAdmin: boolean;
};

export default function SlackIntegrationPanel({
  slackConnected,
  teamName,
  isAdmin,
}: Props) {
  const label = teamName ?? "Slack";

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-[var(--text)]">Slack</h3>
        {slackConnected ? (
          <span className="rounded-full bg-[var(--success)]/15 px-2.5 py-0.5 text-xs font-medium text-[var(--success)]">
            Connected · {label}
          </span>
        ) : (
          <span className="rounded-full border border-[var(--border)] px-2.5 py-0.5 text-xs text-[var(--text-muted)]">
            Not connected
          </span>
        )}
      </div>
      <p className="text-sm text-[var(--text-muted)]">
        Connect Slack to receive approval requests, risk alerts, and interact from Slack via slash commands.
      </p>
      {isAdmin && (
        <div className="flex items-center gap-2">
          <Link href="/org/settings/integrations/slack">
            <Button
              variant={slackConnected ? "outline" : "default"}
              className={!slackConnected ? "bg-[#4A154B] text-white hover:bg-[#611f69]" : ""}
            >
              {slackConnected ? "Configure Slack" : "Connect Slack"}
            </Button>
          </Link>
        </div>
      )}
    </div>
  );
}
