"use client";

import { Button } from "@/ui";
import Link from "next/link";

type Props = {
  orgId: string;
  githubConnected: boolean;
  accountLogin: string | null;
  isAdmin: boolean;
};

export default function GitHubIntegrationPanel({
  githubConnected,
  accountLogin,
  isAdmin,
}: Props) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-[var(--text)]">GitHub</h3>
        {githubConnected ? (
          <span className="rounded-full bg-[var(--success)]/15 px-2.5 py-0.5 text-xs font-medium text-[var(--success)]">
            Connected · {accountLogin ?? "GitHub"}
          </span>
        ) : (
          <span className="rounded-full border border-[var(--border)] px-2.5 py-0.5 text-xs text-[var(--text-muted)]">
            Not connected
          </span>
        )}
      </div>
      <div className="text-xs opacity-70">
        Connect GitHub to detect revenue-impacting changes from pull requests and pushes, and surface governance status in commit statuses.
      </div>
      {isAdmin && (
        <div className="flex items-center gap-2">
          <Link href="/org/settings/integrations/github">
            <Button
              variant={githubConnected ? "outline" : "default"}
              className={!githubConnected ? "bg-[#24292f] text-white hover:bg-[#32383f]" : ""}
            >
              {githubConnected ? "Configure GitHub" : "Connect GitHub"}
            </Button>
          </Link>
        </div>
      )}
    </div>
  );
}
