"use client";

import { useState } from "react";
import { Button, Card, CardBody, Input, Stack } from "@/ui";
import { IntegrationSetupActions } from "./IntegrationSetupActions";

type Props = {
  orgId: string;
  isAdmin: boolean;
  connected: boolean;
  webhookConfigured: boolean;
};

export default function StripeIntegrationCard({
  orgId,
  isAdmin,
  connected,
  webhookConfigured,
}: Props) {
  const [connecting, setConnecting] = useState(false);
  const [testing, setTesting] = useState(false);
  const [secretKey, setSecretKey] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  async function handleConnect() {
    if (!isAdmin || !secretKey.trim()) return;
    setConnecting(true);
    setMsg(null);
    try {
      const res = await fetch("/api/integrations/stripe/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orgId,
          secretKey: secretKey.trim(),
          webhookSecret: webhookSecret.trim() || undefined,
        }),
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
      setConnecting(false);
    }
  }

  async function handleTest() {
    setTesting(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/integrations/stripe/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok && (json as { data?: { success?: boolean } }).data?.success) {
        setMsg("Connection successful");
        setTimeout(() => window.location.reload(), 800);
      } else {
        setMsg((json as { error?: { message?: string } })?.error?.message ?? "Test failed");
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
            {connected ? "Connected" : "Connect Stripe"}
          </div>
          {connected && (
            <div className="rounded border border-[var(--border)] p-3 text-sm">
              <span className="text-[var(--text-muted)]">Webhook: </span>
              <span className={webhookConfigured ? "text-green-600" : "text-amber-600"}>
                {webhookConfigured ? "Configured" : "Not configured"}
              </span>
              <p className="mt-1 text-xs text-[var(--text-muted)]">
                Configure webhook at Stripe Dashboard → Developers → Webhooks, then paste the signing secret below.
              </p>
            </div>
          )}

          {isAdmin && (
            <>
              {!connected && (
                <p className="text-xs text-[var(--text-muted)]">
                  Add your Stripe secret key (sk_live_… or sk_test_…) and optional webhook signing secret.
                </p>
              )}
              <div>
                <label className="text-xs text-[var(--text-muted)]">
                  Secret key {connected ? "(leave blank to keep)" : "(required)"}
                </label>
                <Input
                  value={secretKey}
                  onChange={(e) => setSecretKey(e.target.value)}
                  placeholder="sk_live_…"
                  type="password"
                />
              </div>
              <div>
                <label className="text-xs text-[var(--text-muted)]">Webhook signing secret (optional)</label>
                <Input
                  value={webhookSecret}
                  onChange={(e) => setWebhookSecret(e.target.value)}
                  placeholder="whsec_…"
                  type="password"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={handleConnect}
                  disabled={connecting || (!connected && !secretKey.trim())}
                >
                  {connecting ? "Saving…" : connected ? "Update credentials" : "Connect"}
                </Button>
                {connected && (
                  <Button variant="outline" onClick={handleTest} disabled={testing}>
                    {testing ? "Testing…" : "Test connection"}
                  </Button>
                )}
              </div>
              {connected && (
                <IntegrationSetupActions
                  orgId={orgId}
                  provider="stripe"
                  connected
                />
              )}
            </>
          )}

          {msg && <p className="text-sm text-[var(--text-muted)]">{msg}</p>}
        </Stack>
      </CardBody>
    </Card>
  );
}
