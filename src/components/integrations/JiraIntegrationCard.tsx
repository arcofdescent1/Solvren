"use client";

import { useState } from "react";
import { Button, Card, CardBody } from "@/ui";
import JiraConfigForm from "./JiraConfigForm";
import { IntegrationStatusCard } from "./IntegrationStatusCard";
import { IntegrationHealthCard } from "./IntegrationHealthCard";
import { IntegrationActionsPanel } from "./IntegrationActionsPanel";

type JiraConfig = {
  cloudId?: string;
  siteUrl?: string;
  siteName?: string;
  enabled?: boolean;
  projects?: string[];
  issueTypes?: string[];
  fieldMappings?: Record<string, string>;
  statusMappings?: Record<string, string>;
  features?: {
    webhookSync?: boolean;
    issuePropertySync?: boolean;
    commentSync?: boolean;
    workflowBlocking?: boolean;
  };
};

type Props = {
  orgId: string;
  isAdmin: boolean;
  connected: boolean;
  config: JiraConfig | null;
  lastError: string | null;
  lastSuccessAt: string | null;
  healthStatus: string | null;
};

export default function JiraIntegrationCard({
  orgId,
  isAdmin,
  connected,
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

  const siteUrl = config?.siteUrl ?? config?.siteName ?? "Jira Cloud";
  const projects = config?.projects ?? [];
  const configComplete = connected && Array.isArray(projects) && projects.length > 0;

  async function handleConnect() {
    if (!isAdmin) return;
    setConnecting(true);
    setMsg(null);
    try {
      const res = await fetch("/api/integrations/jira/oauth/start", {
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
      const res = await fetch(`/api/integrations/jira/test?orgId=${encodeURIComponent(orgId)}`, {
        method: "POST",
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok && (json as { success?: boolean }).success) {
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
      const res = await fetch("/api/integrations/jira/retry-failures", {
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
    if (!isAdmin || !confirm("Disconnect Jira? Historical links will be preserved.")) return;
    setDisconnecting(true);
    setMsg(null);
    try {
      const res = await fetch("/api/integrations/jira/disconnect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId: orgId }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok) {
        setMsg("Disconnected");
        setTimeout(() => window.location.reload(), 800);
      } else {
        setMsg((json as { error?: string }).error ?? "Failed to disconnect");
      }
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Failed");
    } finally {
      setDisconnecting(false);
    }
  }

  if (!connected) {
    return (
      <IntegrationStatusCard
        providerLabel="Jira Cloud"
        connectionStatus="disconnected"
      >
        <p className="text-sm text-[var(--text-muted)]">
          Connect Jira Cloud to create Solvren changes from Jira issues, sync status, and display governance in Jira.
        </p>
        {isAdmin && (
          <Button
            onClick={handleConnect}
            disabled={connecting}
            className="bg-[#0052CC] hover:bg-[#0747A6] text-white"
          >
            {connecting ? "Connecting…" : "Connect Jira"}
          </Button>
        )}
        {msg && <p className="text-sm text-red-600">{msg}</p>}
      </IntegrationStatusCard>
    );
  }

  if (connected && !configComplete) {
    return (
      <IntegrationStatusCard
        providerLabel="Jira Cloud"
        connectionStatus="connected"
        accountLabel={siteUrl}
      >
        <p className="text-sm text-[var(--text-muted)]">
          Finish configuration by adding projects and status mappings.
        </p>
        {isAdmin && (
          <Button onClick={() => setShowForm(true)}>Finish configuration</Button>
        )}
        {msg && <p className="text-sm text-red-600">{msg}</p>}
        {showForm && (
          <JiraConfigForm
            orgId={orgId}
            initialConfig={config}
            onSaved={() => {
              setShowForm(false);
              window.location.reload();
            }}
            onCancel={() => setShowForm(false)}
          />
        )}
      </IntegrationStatusCard>
    );
  }

  return (
    <div className="space-y-4">
      <IntegrationStatusCard
        providerLabel="Jira Cloud"
        connectionStatus="configured"
        accountLabel={siteUrl}
      >
        <p className="text-sm text-[var(--text-muted)]">
          Projects: {projects.length ? projects.join(", ") : "—"}
        </p>
      </IntegrationStatusCard>
      <IntegrationHealthCard
        healthStatus={healthStatus as "healthy" | "degraded" | "error" | null}
        lastSuccessAt={lastSuccessAt}
        lastError={lastError}
      />
      <div className="space-y-2">
        <IntegrationActionsPanel
          isAdmin={!!isAdmin}
          onTestConnection={handleTest}
          onRetryFailures={handleRetryFailures}
          onDisconnect={handleDisconnect}
          testing={testing}
          retrying={retrying}
          disconnecting={disconnecting}
        />
        {isAdmin && (
          <Button variant="outline" size="sm" onClick={() => setShowForm(!showForm)}>
            {showForm ? "Hide config" : "Edit config"}
          </Button>
        )}
      </div>
      {msg && <p className="text-sm text-red-600">{msg}</p>}
      {showForm && (
        <Card>
          <CardBody>
            <JiraConfigForm
              orgId={orgId}
              initialConfig={config}
              onSaved={() => {
                setShowForm(false);
                window.location.reload();
              }}
              onCancel={() => setShowForm(false)}
            />
          </CardBody>
        </Card>
      )}
    </div>
  );
}
