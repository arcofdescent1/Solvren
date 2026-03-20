"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardBody } from "@/ui";

type Integration = { provider: string; connected: boolean };

const PROVIDER_LABELS: Record<string, string> = {
  jira: "Jira",
  slack: "Slack",
  github: "GitHub",
  salesforce: "Salesforce",
  hubspot: "HubSpot",
  netsuite: "NetSuite",
};

export type IntegrationStatusPanelProps = {
  orgId: string | null;
};

export function IntegrationStatusPanel({ orgId }: IntegrationStatusPanelProps) {
  const [integrations, setIntegrations] = useState<Integration[]>([]);

  useEffect(() => {
    if (!orgId) {
      queueMicrotask(() => setIntegrations([]));
      return;
    }
    fetch(`/api/integrations/list?orgId=${encodeURIComponent(orgId)}`)
      .then((r) => r.json())
      .then((j) => {
        const list = (j as { integrations?: Record<string, { connected: boolean }> }).integrations;
        if (!list || typeof list !== "object") {
          setIntegrations([]);
          return;
        }
        setIntegrations(
          Object.entries(list).map(([provider, entry]) => ({
            provider,
            connected: !!entry?.connected,
          }))
        );
      })
      .catch(() => setIntegrations([]));
  }, [orgId]);

  if (!orgId) return null;

  return (
    <Card>
      <CardBody className="py-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--text-muted)]">
          Connected systems
        </h2>
        <ul className="mt-3 space-y-2">
          {integrations.length === 0 ? (
            <li className="text-sm text-[var(--text-muted)]">Loading…</li>
          ) : (
            integrations.map(({ provider, connected }) => (
              <li key={provider} className="flex items-center justify-between gap-2 text-sm">
                <span className="flex items-center gap-2 text-[var(--text)]">
                  {connected ? (
                    <span className="text-green-600 dark:text-green-400" aria-hidden>✓</span>
                  ) : (
                    <span className="w-4" aria-hidden />
                  )}
                  {PROVIDER_LABELS[provider] ?? provider}
                </span>
                {!connected && (
                  <Link
                    href="/org/settings/integrations"
                    className="text-xs font-medium text-[var(--primary)] hover:underline"
                  >
                    Connect
                  </Link>
                )}
              </li>
            ))
          )}
        </ul>
      </CardBody>
    </Card>
  );
}
