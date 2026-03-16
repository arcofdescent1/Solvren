"use client";

import { useState } from "react";
import { Button, Card, CardBody, Badge } from "@/ui";
import SlackConfigForm from "./SlackConfigForm";

type SlackConfig = {
  enabled?: boolean;
  features?: Record<string, boolean>;
  routing?: Record<string, string | null>;
  messagePolicy?: Record<string, boolean>;
};

type Props = {
  orgId: string;
  isAdmin: boolean;
  connected: boolean;
  teamName: string | null;
  config: SlackConfig | null;
  lastError: string | null;
  lastSuccessAt: string | null;
  healthStatus: string | null;
};

export default function SlackIntegrationCard({
  orgId,
  isAdmin,
  connected,
  teamName,
  config,
  lastError,
  lastSuccessAt,
  healthStatus,
}: Props) {
  const [connecting, setConnecting] = useState(false);
  const [testing, setTesting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const hasChannels = Boolean(
    config?.routing?.approvalChannelId ?? config?.routing?.riskAlertChannelId
  );
  const configComplete = connected && hasChannels;

  async function handleConnect() {
    if (!isAdmin) return;
    setConnecting(true);
    setMsg(null);
    try {
      const res = await fetch("/api/integrations/slack/install", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId: orgId }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg((json as { error?: string }).error ?? "Failed to start OAuth");
        return;
      }
      const url = (json as { authorizeUrl?: string }).authorizeUrl;
      if (url) window.location.href = url;
      else setMsg("No authorize URL returned");
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
      const res = await fetch(`/api/integrations/slack/test?orgId=${encodeURIComponent(orgId)}`, {
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
      const res = await fetch("/api/integrations/slack/retry-failures", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId: orgId }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok) {
        const queued = (json as { queued?: number }).queued ?? 0;
        setMsg(queued ? `Queued ${queued} for retry` : "No pending failures");
        setTimeout(() => window.location.reload(), 1200);
      } else {
        setMsg((json as { error?: string }).error ?? "Failed");
      }
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Failed");
    } finally {
      setRetrying(false);
    }
  }

  async function handleDisconnect() {
    if (!isAdmin || !confirm("Disconnect Slack?")) return;
    setDisconnecting(true);
    setMsg(null);
    try {
      const res = await fetch("/api/integrations/slack/disconnect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId: orgId }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok) {
        setMsg("Disconnected");
        setTimeout(() => window.location.reload(), 800);
      } else {
        setMsg((json as { error?: string }).error ?? "Failed");
      }
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Failed");
    } finally {
      setDisconnecting(false);
    }
  }

  if (!connected) {
    return (
      <Card>
        <CardBody className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="font-semibold">Slack</span>
            <Badge variant="secondary">Not connected</Badge>
          </div>
          <p className="text-sm text-[var(--text-muted)]">
            Connect Slack to receive approval requests, risk alerts, and act on approvals from Slack.
          </p>
          {isAdmin && (
            <Button onClick={handleConnect} disabled={connecting} className="bg-[#4A154B] hover:bg-[#611f69] text-white">
              {connecting ? "Connecting…" : "Connect Slack"}
            </Button>
          )}
          {msg && <p className="text-sm text-red-600">{msg}</p>}
        </CardBody>
      </Card>
    );
  }

  if (connected && !configComplete) {
    return (
      <Card>
        <CardBody className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="font-semibold">Slack</span>
            <Badge className="bg-green-100 text-green-800">Connected · {teamName ?? "Workspace"}</Badge>
          </div>
          <p className="text-sm text-[var(--text-muted)]">Finish configuration by setting channels.</p>
          {isAdmin && (
            <>
              <Button onClick={() => setShowForm(true)}>Finish configuration</Button>
              {showForm && (
                <SlackConfigForm orgId={orgId} initialConfig={config} onSaved={() => { setShowForm(false); window.location.reload(); }} onCancel={() => setShowForm(false)} />
              )}
            </>
          )}
          {msg && <p className="text-sm text-red-600">{msg}</p>}
        </CardBody>
      </Card>
    );
  }

  return (
    <Card>
      <CardBody className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="font-semibold">Slack</span>
          <Badge className="bg-green-100 text-green-800">Connected · {teamName ?? "Workspace"}</Badge>
        </div>
        {lastError && <p className="text-sm text-red-600">{lastError}</p>}
        {isAdmin && (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowForm(!showForm)}>{showForm ? "Hide config" : "Edit config"}</Button>
            <Button variant="outline" size="sm" onClick={handleTest} disabled={testing}>{testing ? "Testing…" : "Test connection"}</Button>
            <Button variant="outline" size="sm" onClick={handleRetryFailures} disabled={retrying}>Retry failures</Button>
            <Button variant="outline" size="sm" onClick={handleDisconnect} disabled={disconnecting} className="text-red-600">Disconnect</Button>
          </div>
        )}
        {msg && <p className="text-sm text-red-600">{msg}</p>}
        {showForm && (
          <SlackConfigForm orgId={orgId} initialConfig={config} onSaved={() => { setShowForm(false); window.location.reload(); }} onCancel={() => setShowForm(false)} />
        )}
      </CardBody>
    </Card>
  );
}
