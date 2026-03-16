"use client";

import { useState } from "react";
import { Button, Card, CardBody } from "@/ui";

type Check = { name: string; status: "ok" | "warning" | "error"; message?: string };

type Props = {
  orgId: string;
  onSuccess: () => void;
  onRetry?: () => void;
};

export function JiraValidationChecklist({ orgId, onSuccess, onRetry }: Props) {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    checks: Check[];
    error?: string;
  } | null>(null);

  const run = async () => {
    setRunning(true);
    setResult(null);
    try {
      const res = await fetch(`/api/integrations/jira/test?orgId=${encodeURIComponent(orgId)}`, {
        method: "POST",
      });
      const json = await res.json().catch(() => ({}));
      setResult({
        success: json.success ?? false,
        checks: json.checks ?? [],
        error: json.error,
      });
    } catch (e) {
      setResult({
        success: false,
        checks: [],
        error: e instanceof Error ? e.message : "Test failed",
      });
    } finally {
      setRunning(false);
    }
  };

  return (
    <Card>
      <CardBody className="space-y-4">
        <h3 className="font-semibold text-lg">Validate integration</h3>
        <p className="text-sm text-[var(--text-muted)]">
          Run a connection test to verify Jira is configured correctly.
        </p>

        {!result && !running && (
          <Button onClick={run}>Run connection test</Button>
        )}

        {running && <p className="text-sm text-[var(--text-muted)]">Testing…</p>}

        {result && (
          <>
            <div className="space-y-2">
              {result.checks.map((c) => (
                <div
                  key={c.name}
                  className="flex items-center gap-2 text-sm"
                  data-status={c.status}
                >
                  {c.status === "ok" && (
                    <span className="text-green-600" aria-hidden>✓</span>
                  )}
                  {c.status === "warning" && (
                    <span className="text-amber-600" aria-hidden>⚠</span>
                  )}
                  {c.status === "error" && (
                    <span className="text-red-600" aria-hidden>✗</span>
                  )}
                  <span className="capitalize">{c.name.replace(/_/g, " ")}</span>
                  {c.message && (
                    <span className="text-[var(--text-muted)]">— {c.message}</span>
                  )}
                </div>
              ))}
            </div>
            {result.error && (
              <p className="text-sm text-red-600">{result.error}</p>
            )}
            <div className="flex gap-2">
              {result.success ? (
                <Button onClick={onSuccess}>Continue to completion</Button>
              ) : (
                <>
                  {onRetry && <Button variant="outline" onClick={onRetry}>Retry</Button>}
                  <Button onClick={run} disabled={running}>
                    Run test again
                  </Button>
                </>
              )}
            </div>
          </>
        )}
      </CardBody>
    </Card>
  );
}
