"use client";

import { useState } from "react";
import { Button, Card, CardBody, Input, Stack } from "@/ui";

type Props = {
  orgId: string;
  isAdmin: boolean;
  connected: boolean;
  accountId: string | null;
  accountName: string | null;
  lastError: string | null;
  lastSuccessAt?: string | null;
  healthStatus?: string | null;
};

export default function NetSuiteIntegrationCard({
  orgId,
  isAdmin,
  connected,
  accountId,
  accountName,
  lastError,
  lastSuccessAt,
  healthStatus,
}: Props) {
  const [accountIdInput, setAccountIdInput] = useState(accountId ?? "");
  const [clientIdInput, setClientIdInput] = useState("");
  const [clientSecretInput, setClientSecretInput] = useState("");
  const [envInput, setEnvInput] = useState<"production" | "sandbox">("sandbox");
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function handleSave() {
    if (!isAdmin) return;
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch("/api/integrations/netsuite/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId: orgId,
          accountId: accountIdInput.trim(),
          environment: envInput,
          clientId: clientIdInput.trim() || undefined,
          clientSecret: clientSecretInput || undefined,
        }),
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
      const res = await fetch(`/api/integrations/netsuite/test?orgId=${encodeURIComponent(orgId)}`, { method: "POST" });
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
            {connected ? `Connected · ${accountName ?? accountId ?? "NetSuite"}` : "Connect NetSuite"}
          </div>
          {lastError && <p className="text-sm text-amber-600">{lastError}</p>}
          {connected && (healthStatus || lastSuccessAt) && (
            <div className="rounded border border-[var(--border)] p-3 text-sm">
              <span className="text-[var(--text-muted)]">Status: </span>
              <span className={healthStatus === "healthy" ? "text-green-600" : healthStatus === "error" ? "text-amber-600" : ""}>
                {healthStatus ?? "—"}
              </span>
              {lastSuccessAt && (
                <span className="ml-2 text-[var(--text-muted)]">
                  Last success: {new Date(lastSuccessAt).toLocaleString()}
                </span>
              )}
            </div>
          )}

          {isAdmin && (
            <>
              <div>
                <label className="text-xs text-[var(--text-muted)]">Account ID</label>
                <Input
                  value={accountIdInput}
                  onChange={(e) => setAccountIdInput(e.target.value)}
                  placeholder="1234567_SB1"
                />
              </div>
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
                <label className="text-xs text-[var(--text-muted)]">OAuth Client ID</label>
                <Input value={clientIdInput} onChange={(e) => setClientIdInput(e.target.value)} placeholder="Leave blank to keep existing" type="password" />
              </div>
              <div>
                <label className="text-xs text-[var(--text-muted)]">OAuth Client Secret</label>
                <Input value={clientSecretInput} onChange={(e) => setClientSecretInput(e.target.value)} placeholder="Leave blank to keep existing" type="password" />
              </div>
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
            </>
          )}
          {msg && <p className="text-sm text-[var(--text-muted)]">{msg}</p>}
        </Stack>
      </CardBody>
    </Card>
  );
}
