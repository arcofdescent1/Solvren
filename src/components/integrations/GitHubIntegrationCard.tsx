"use client";

import { useState, useEffect } from "react";
import { Button, Card, CardBody, Badge, Stack } from "@/ui";

type Installation = {
  installationId: number;
  accountLogin: string;
  accountType: string;
};

type RepoConfig = {
  repositoryId: number;
  fullName: string;
  enabled: boolean;
  autoCreateChangeFromPr: boolean;
  autoDetectPushChanges: boolean;
  statusChecksEnabled: boolean;
  filePathRules: Array<{ pattern: string; domain: string; riskWeight: number }>;
};

type Props = {
  orgId: string;
  isAdmin: boolean;
  connected: boolean;
  installation: Installation | null;
  lastError: string | null;
  lastSuccessAt: string | null;
  healthStatus: string | null;
};

export default function GitHubIntegrationCard({
  orgId,
  isAdmin,
  connected,
  installation,
  lastError,
}: Props) {
  const [connecting, setConnecting] = useState(false);
  const [testing, setTesting] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [config, setConfig] = useState<{
    repositories?: RepoConfig[];
    health?: { lastWebhookAt?: string; failedEventCount?: number };
  } | null>(null);

  useEffect(() => {
    if (connected && orgId) {
      fetch(`/api/integrations/github/config?orgId=${encodeURIComponent(orgId)}`)
        .then((r) => r.json())
        .then((d) => setConfig(d))
        .catch(() => setConfig(null));
    }
  }, [connected, orgId]);

  async function handleConnect() {
    if (!isAdmin) return;
    setConnecting(true);
    setMsg(null);
    try {
      const res = await fetch("/api/integrations/github/connect/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId: orgId }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg((json as { error?: string }).error ?? "Failed to start");
        return;
      }
      const url = (json as { installUrl?: string }).installUrl;
      if (url) window.location.href = url;
      else setMsg("No install URL returned");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Failed");
    } finally {
      setConnecting(false);
    }
  }

  async function handleTest() {
    setTesting(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/integrations/github/test?orgId=${encodeURIComponent(orgId)}`, {
        method: "POST",
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok && (json as { status?: string }).status === "ok") {
        setMsg("Connection successful");
        setTimeout(() => window.location.reload(), 800);
      } else {
        setMsg((json as { error?: string }).error ?? "Test failed");
      }
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Failed");
    } finally {
      setTesting(false);
    }
  }

  async function handleRetryFailures() {
    setRetrying(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/integrations/github/retry-failures?orgId=${encodeURIComponent(orgId)}`, {
        method: "POST",
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok) {
        const q = (json as { queued?: number }).queued ?? 0;
        setMsg(q > 0 ? `Queued ${q} for retry` : "No failures to retry");
        setTimeout(() => window.location.reload(), 1000);
      } else {
        setMsg((json as { error?: string }).error ?? "Retry failed");
      }
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Failed");
    } finally {
      setRetrying(false);
    }
  }

  const repos = config?.repositories ?? [];
  const hasRepos = repos.length > 0;

  return (
    <Card>
      <CardBody>
        <Stack gap={4}>
          <div className="flex items-center justify-between">
            <span className="font-semibold">GitHub App</span>
            {connected ? (
              <Badge variant="default">
                Connected · {installation?.accountLogin ?? "GitHub"}
              </Badge>
            ) : (
              <Badge variant="outline">Not connected</Badge>
            )}
          </div>
          <p className="text-xs text-[var(--text-muted)]">
            Connect GitHub to detect revenue-impacting changes from pull requests and pushes.
            Governance status appears in commit statuses.
          </p>

          {lastError && (
            <p className="text-sm text-amber-600">{lastError}</p>
          )}

          {connected && hasRepos && (
            <div className="text-sm text-[var(--text-muted)]">
              {repos.length} repository{repos.length !== 1 ? "ies" : ""} configured
              {config?.health?.lastWebhookAt && (
                <span className="ml-2">
                  · Last webhook: {new Date(config.health.lastWebhookAt).toLocaleString()}
                </span>
              )}
            </div>
          )}

          {isAdmin && (
            <div className="flex flex-wrap gap-2">
              {!connected ? (
                <Button
                  onClick={handleConnect}
                  disabled={connecting}
                >
                  {connecting ? "Redirecting…" : "Connect GitHub"}
                </Button>
              ) : (
                <>
                  <Button variant="outline" size="sm" onClick={handleTest} disabled={testing}>
                    {testing ? "Testing…" : "Test connection"}
                  </Button>
                  {(config?.health?.failedEventCount ?? 0) > 0 && (
                    <Button variant="outline" size="sm" onClick={handleRetryFailures} disabled={retrying}>
                      {retrying ? "Queuing…" : "Retry failed events"}
                    </Button>
                  )}
                  <Button asChild variant="outline" size="sm">
                    <a href={`/org/settings/integrations/github?orgId=${orgId}#configure`}>
                      Configure repos
                    </a>
                  </Button>
                </>
              )}
            </div>
          )}

          {msg && <p className="text-sm text-[var(--text-muted)]">{msg}</p>}
        </Stack>
      </CardBody>
    </Card>
  );
}
