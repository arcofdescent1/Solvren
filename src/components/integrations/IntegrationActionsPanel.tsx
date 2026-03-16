"use client";

import { Button } from "@/ui";

type IntegrationActionsPanelProps = {
  isAdmin: boolean;
  onTestConnection?: () => void;
  onRetryFailures?: () => void;
  onDisconnect?: () => void;
  testing?: boolean;
  retrying?: boolean;
  disconnecting?: boolean;
};

export function IntegrationActionsPanel({
  isAdmin,
  onTestConnection,
  onRetryFailures,
  onDisconnect,
  testing = false,
  retrying = false,
  disconnecting = false,
}: IntegrationActionsPanelProps) {
  if (!isAdmin) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {onTestConnection && (
        <Button
          variant="outline"
          size="sm"
          onClick={onTestConnection}
          disabled={testing}
        >
          {testing ? "Testing…" : "Test connection"}
        </Button>
      )}
      {onRetryFailures && (
        <Button
          variant="outline"
          size="sm"
          onClick={onRetryFailures}
          disabled={retrying}
        >
          {retrying ? "Retrying…" : "Retry Now"}
        </Button>
      )}
      {onDisconnect && (
        <Button
          variant="outline"
          size="sm"
          onClick={onDisconnect}
          disabled={disconnecting}
          className="text-red-600 hover:text-red-700"
        >
          {disconnecting ? "Disconnecting…" : "Disconnect"}
        </Button>
      )}
    </div>
  );
}
