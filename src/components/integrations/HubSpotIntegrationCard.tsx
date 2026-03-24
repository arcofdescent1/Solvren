"use client";

import { useState } from "react";
import { Button, Card, CardBody, Input, Stack } from "@/ui";
import { IntegrationSetupActions } from "./IntegrationSetupActions";

type Props = {
  orgId: string;
  isAdmin: boolean;
  connected: boolean;
  hubId: number | null;
  authMode: string | null;
  lastError: string | null;
  lastSuccessAt?: string | null;
  healthStatus?: string | null;
  objectsMonitored?: string[];
};

export default function HubSpotIntegrationCard({
  orgId,
  isAdmin,
  connected,
  hubId,
  authMode,
  lastError,
  lastSuccessAt,
  healthStatus,
  objectsMonitored = [],
}: Props) {
  const [connecting, setConnecting] = useState(false);
  const [testing, setTesting] = useState(false);
  const [privateToken, setPrivateToken] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function handleOAuthConnect() {
    if (!isAdmin) return;
    setConnecting(true);
    setMsg(null);
    try {
      const res = await fetch("/api/integrations/hubspot/oauth/start", {
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

  async function handlePrivateAppSave() {
    if (!isAdmin || !privateToken.trim()) return;
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch("/api/integrations/hubspot/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId: orgId, privateAppToken: privateToken.trim() }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok) {
        setMsg("Saved");
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
      const res = await fetch(`/api/integrations/hubspot/test?orgId=${encodeURIComponent(orgId)}`, { method: "POST" });
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
            {connected ? `Connected · ${hubId ?? "HubSpot"}` : "Connect HubSpot"}
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

          {isAdmin && !connected && (
            <>
              <p className="text-xs text-[var(--text-muted)]">Connect with OAuth (multi-account) or private app token (single account).</p>
              <div className="flex gap-2">
                <Button onClick={handleOAuthConnect} disabled={connecting}>
                  {connecting ? "Redirecting…" : "Connect with OAuth"}
                </Button>
              </div>
              <div>
                <label className="text-xs text-[var(--text-muted)]">Or paste private app token</label>
                <Input value={privateToken} onChange={(e) => setPrivateToken(e.target.value)} placeholder="pat-na1-…" type="password" />
                <Button className="mt-2" onClick={handlePrivateAppSave} disabled={saving || !privateToken.trim()}>
                  {saving ? "Saving…" : "Save private app token"}
                </Button>
              </div>
            </>
          )}

          {isAdmin && connected && (
            <>
              <div className="flex gap-2">
                <Button variant="outline" onClick={handleTest} disabled={testing}>
                  {testing ? "Testing…" : "Test connection"}
                </Button>
              {authMode === "private_app" && (
                <div>
                  <label className="text-xs text-[var(--text-muted)]">Update private app token</label>
                  <Input value={privateToken} onChange={(e) => setPrivateToken(e.target.value)} placeholder="Leave blank to keep" type="password" />
                  <Button className="mt-2" onClick={handlePrivateAppSave} disabled={saving || !privateToken.trim()}>
                    Update token
                  </Button>
                </div>
              )}
              </div>
              <IntegrationSetupActions orgId={orgId} provider="hubspot" connected />
            </>
          )}

          {msg && <p className="text-sm text-[var(--text-muted)]">{msg}</p>}
        </Stack>
      </CardBody>
    </Card>
  );
}
