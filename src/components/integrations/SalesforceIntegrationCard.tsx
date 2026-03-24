"use client";

import { useState } from "react";
import { Button, Card, CardBody, Input, Stack } from "@/ui";
import { IntegrationSetupActions } from "./IntegrationSetupActions";

type Props = {
  orgId: string;
  isAdmin: boolean;
  connected: boolean;
  sfOrgId: string | null;
  instanceUrl: string | null;
  lastError: string | null;
  lastSuccessAt?: string | null;
  healthStatus?: string | null;
  objectsMonitored?: string[];
};

export default function SalesforceIntegrationCard({
  orgId,
  isAdmin,
  connected,
  sfOrgId,
  instanceUrl,
  lastError,
  lastSuccessAt,
  healthStatus,
  objectsMonitored = [],
}: Props) {
  const [clientIdInput, setClientIdInput] = useState("");
  const [clientSecretInput, setClientSecretInput] = useState("");
  const [envInput, setEnvInput] = useState<"production" | "sandbox">("sandbox");
  const [authModeInput, setAuthModeInput] = useState<"client_credentials" | "jwt_bearer">("client_credentials");
  const [usernameInput, setUsernameInput] = useState("");
  const [jwtKeyInput, setJwtKeyInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function handleSave() {
    if (!isAdmin) return;
    setSaving(true);
    setMsg(null);
    try {
      const payload: Record<string, unknown> = {
        organizationId: orgId,
        environment: envInput,
        authMode: authModeInput,
        clientId: clientIdInput.trim() || undefined,
      };
      if (authModeInput === "client_credentials") {
        payload.clientSecret = clientSecretInput.trim() || undefined;
      } else {
        payload.username = usernameInput.trim() || undefined;
        payload.jwtPrivateKeyBase64 = jwtKeyInput.trim() || undefined;
      }
      const res = await fetch("/api/integrations/salesforce/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok) {
        setMsg("Configuration saved");
        setTimeout(() => window.location.reload(), 800);
      } else {
        setMsg((json as { error?: string }).error ?? "Save failed");
      }
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleTest() {
    setTesting(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/integrations/salesforce/test?orgId=${encodeURIComponent(orgId)}`, { method: "POST" });
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

  return (
    <Card>
      <CardBody>
        <Stack gap={4}>
          <div className="font-semibold">
            {connected ? `Connected · ${sfOrgId ?? instanceUrl ?? "Salesforce"}` : "Connect Salesforce"}
          </div>
          {lastError && <p className="text-sm text-amber-600">{lastError}</p>}
          {connected && (healthStatus || lastSuccessAt) && (
            <div className="rounded border border-[var(--border)] p-3 text-sm">
              <span className="text-[var(--text-muted)]">Status: </span>
              <span className={healthStatus === "healthy" ? "text-green-600" : healthStatus === "error" ? "text-amber-600" : ""}>
                {healthStatus ?? "—"}
              </span>
              {lastSuccessAt && (
                <span className="ml-2 text-[var(--text-muted)]">Last success: {new Date(lastSuccessAt).toLocaleString()}</span>
              )}
            </div>
          )}
          {connected && objectsMonitored.length > 0 && (
            <div className="rounded border border-[var(--border)] p-3 text-sm">
              <p className="font-medium">Objects monitored</p>
              <p className="text-[var(--text-muted)]">{objectsMonitored.join(", ")}</p>
            </div>
          )}

          {isAdmin && (
            <>
              <div>
                <label className="text-xs text-[var(--text-muted)]">Environment</label>
                <select
                  value={envInput}
                  onChange={(e) => setEnvInput(e.target.value as "production" | "sandbox")}
                  className="h-10 w-full rounded border px-3 text-sm"
                >
                  <option value="sandbox">Sandbox</option>
                  <option value="production">Production</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-[var(--text-muted)]">Auth mode</label>
                <select
                  value={authModeInput}
                  onChange={(e) => setAuthModeInput(e.target.value as "client_credentials" | "jwt_bearer")}
                  className="h-10 w-full rounded border px-3 text-sm"
                >
                  <option value="client_credentials">Client credentials</option>
                  <option value="jwt_bearer">JWT Bearer</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-[var(--text-muted)]">Connected App Client ID</label>
                <Input value={clientIdInput} onChange={(e) => setClientIdInput(e.target.value)} placeholder="Consumer key" type="password" />
              </div>
              {authModeInput === "client_credentials" && (
                <div>
                  <label className="text-xs text-[var(--text-muted)]">Client Secret</label>
                  <Input value={clientSecretInput} onChange={(e) => setClientSecretInput(e.target.value)} placeholder="Leave blank to keep existing" type="password" />
                </div>
              )}
              {authModeInput === "jwt_bearer" && (
                <>
                  <div>
                    <label className="text-xs text-[var(--text-muted)]">Integration user username</label>
                    <Input value={usernameInput} onChange={(e) => setUsernameInput(e.target.value)} placeholder="user@company.com" />
                  </div>
                  <div>
                    <label className="text-xs text-[var(--text-muted)]">Private key (base64)</label>
                    <Input value={jwtKeyInput} onChange={(e) => setJwtKeyInput(e.target.value)} placeholder="Base64-encoded PEM" type="password" />
                  </div>
                </>
              )}
              <div className="flex gap-2">
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? "Saving…" : "Save"}
                </Button>
                {connected && (
                  <Button variant="outline" onClick={handleTest} disabled={testing}>
                    {testing ? "Testing…" : "Test connection"}
                  </Button>
                )}
              </div>
              {connected && (
                <IntegrationSetupActions orgId={orgId} provider="salesforce" connected />
              )}
            </>
          )}
          {msg && <p className="text-sm text-[var(--text-muted)]">{msg}</p>}
        </Stack>
      </CardBody>
    </Card>
  );
}
