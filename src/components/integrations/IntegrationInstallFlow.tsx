"use client";

/**
 * Phase 1 — Install flow UX (§13.5): value → permissions → auth → callback → test → backfill.
 */
import * as React from "react";
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
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
      setStep("permissions");
    }
  }, [manifest.provider, orgId]);

  return (
    <div className="flex flex-col gap-6 rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] p-6">
      <div>
        <h3 className="text-lg font-semibold text-[var(--text)]">{manifest.displayName} — Connect</h3>
        <p className="mt-1 text-sm text-[var(--text-muted)]">{manifest.description}</p>
      </div>

      {step === "value" && (
        <>
          <div className="rounded-md bg-[var(--bg-muted)] p-4 text-sm text-[var(--text)]">
            <p className="font-medium">What you get:</p>
            <ul className="mt-2 list-inside list-disc space-y-1 text-[var(--text-muted)]">
              {manifest.capabilities.includes("read_objects") && <li>Read and sync key objects</li>}
              {manifest.capabilities.includes("receive_events") && <li>Real-time events</li>}
              {manifest.capabilities.includes("execute_actions") && <li>Outbound actions (e.g. create tasks, post to channels)</li>}
              {manifest.capabilities.includes("health_checks") && <li>Connection health monitoring</li>}
            </ul>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setStep("permissions")}
              className="rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-fg)] hover:opacity-90"
            >
              Continue
            </button>
            {onCancel && (
              <button type="button" onClick={onCancel} className="rounded-md border border-[var(--border)] px-4 py-2 text-sm hover:bg-[var(--bg-muted)]">
                Cancel
              </button>
            )}
          </div>
        </>
      )}

      {step === "permissions" && (
        <>
          <div className="rounded-md bg-[var(--bg-muted)] p-4 text-sm">
            <p className="font-medium text-[var(--text)]">Required permissions</p>
            <p className="mt-1 text-[var(--text-muted)]">We will request the following scopes. You can revoke access anytime from your provider settings.</p>
            <ul className="mt-2 list-inside list-disc space-y-1 text-[var(--text-muted)]">
              {manifest.requiredScopes.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          </div>
          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={startAuth}
              className="rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-fg)] hover:opacity-90"
            >
              Connect with {manifest.displayName}
            </button>
            {onCancel && (
              <button type="button" onClick={onCancel} className="rounded-md border border-[var(--border)] px-4 py-2 text-sm hover:bg-[var(--bg-muted)]">
                Cancel
              </button>
            )}
          </div>
        </>
      )}

      {step === "connecting" && (
        <p className="text-sm text-[var(--text-muted)]">Redirecting to {manifest.displayName} to authorize…</p>
      )}
    </div>
  );
}
