"use client";

import { Card, CardBody, Badge } from "@/ui";

export type ConnectionStatus = "disconnected" | "connecting" | "connected" | "configured" | "error";

type IntegrationStatusCardProps = {
  providerLabel: string;
  connectionStatus: ConnectionStatus;
  accountLabel?: string | null;
  children?: React.ReactNode;
};

const STATUS_BADGES: Record<ConnectionStatus, { label: string; variant: "secondary" | "default" | "danger" }> = {
  disconnected: { label: "Not connected", variant: "secondary" },
  connecting: { label: "Connecting…", variant: "secondary" },
  connected: { label: "Connected", variant: "default" },
  configured: { label: "Configured", variant: "default" },
  error: { label: "Error", variant: "danger" },
};

export function IntegrationStatusCard({
  providerLabel,
  connectionStatus,
  accountLabel,
  children,
}: IntegrationStatusCardProps) {
  const badge = STATUS_BADGES[connectionStatus] ?? STATUS_BADGES.disconnected;

  return (
    <Card>
      <CardBody className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="font-semibold">{providerLabel}</span>
          <div className="flex items-center gap-2">
            <Badge variant={badge.variant}>{badge.label}</Badge>
            {accountLabel && connectionStatus !== "disconnected" && (
              <span className="text-sm text-[var(--text-muted)]">{accountLabel}</span>
            )}
          </div>
        </div>
        {children}
      </CardBody>
    </Card>
  );
}
