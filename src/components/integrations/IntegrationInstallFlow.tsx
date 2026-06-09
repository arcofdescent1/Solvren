"use client";

import * as React from "react";
import { Button, Card, CardBody } from "@/ui";
import type { ConnectorManifest } from "@/modules/integrations/contracts";

export type IntegrationInstallFlowProps = {
  manifest: ConnectorManifest;
  orgId: string;
  onComplete?: () => void;
  onCancel?: () => void;
};

export function IntegrationInstallFlow({ manifest, orgId, onComplete: _onComplete, onCancel }: IntegrationInstallFlowProps) {
  const [step, setStep] = React.useState<"value" | "permissions" | "connecting" | "done">("value");
  const [error, setError] = React.useState<string | null>(null);

  const startAuth = React.useCallback(async () => {
    setError(null);
    setStep("connecting");
    try {
      const res = await fetch(`/api/integrations/${manifest.provider}/connect/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId }),
      });
      const data = await res.json();
      if (!data.ok || !data.data?.authUrl) {
        setError(data.error?.message ?? "Failed to start connection");
        setStep("permissions");
        return;
      }
      window.location.href = data.data.authUrl;
    } catch (errorValue) {
      setError(errorValue instanceof Error ? errorValue.message : "Network error");
      setStep("permissions");
    }
  }, [manifest.provider, orgId]);

  return (
    <Card>
      <CardBody className="space-y-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Connect system</p>
          <h3 className="mt-1 text-lg font-semibold text-[var(--text)]">{manifest.displayName}</h3>
          <p className="mt-1 text-sm text-[var(--text-muted)]">{manifest.description}</p>
        </div>

        {step === "value" ? (
          <>
            <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--bg-surface-2)] p-4 text-sm text-[var(--text)]">
              <p className="font-semibold">What Solvren will protect with this connection</p>
              <ul className="mt-2 list-inside list-disc space-y-1 text-[var(--text-muted)]">
                {manifest.capabilities.includes("read_objects") ? <li>Sync the records needed to spot revenue risk</li> : null}
                {manifest.capabilities.includes("receive_events") ? <li>Watch for events that need attention</li> : null}
                {manifest.capabilities.includes("execute_actions") ? <li>Create tasks or updates when action is needed</li> : null}
                {manifest.capabilities.includes("health_checks") ? <li>Confirm the connection is healthy over time</li> : null}
              </ul>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={() => setStep("permissions")}>
                Continue
              </Button>
              {onCancel ? (
                <Button type="button" variant="secondary" onClick={onCancel}>
                  Cancel
                </Button>
              ) : null}
            </div>
          </>
        ) : null}

        {step === "permissions" ? (
          <>
            <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--bg-surface-2)] p-4 text-sm">
              <p className="font-semibold text-[var(--text)]">Access Solvren needs</p>
              <p className="mt-1 text-[var(--text-muted)]">
                Solvren asks only for the provider access needed to protect this workflow. Access can be revoked from the provider at any time.
              </p>
              <ul className="mt-2 list-inside list-disc space-y-1 text-[var(--text-muted)]">
                {manifest.requiredScopes.map((scope) => (
                  <li key={scope}>{scope}</li>
                ))}
              </ul>
            </div>
            {error ? (
              <p className="rounded-[var(--radius-md)] border border-[var(--danger)]/30 bg-[var(--danger)]/10 px-3 py-2 text-sm text-[var(--danger)]">
                {error}
              </p>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={startAuth}>
                Connect {manifest.displayName}
              </Button>
              {onCancel ? (
                <Button type="button" variant="secondary" onClick={onCancel}>
                  Cancel
                </Button>
              ) : null}
            </div>
          </>
        ) : null}

        {step === "connecting" ? (
          <p className="text-sm text-[var(--text-muted)]">Redirecting to {manifest.displayName} to authorize...</p>
        ) : null}
      </CardBody>
    </Card>
  );
}
