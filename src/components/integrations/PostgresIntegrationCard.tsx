"use client";

import { useState } from "react";
import { Button, Card, CardBody, Input, Stack } from "@/ui";
import { IntegrationSetupActions } from "./IntegrationSetupActions";

type Props = {
  orgId: string;
  isAdmin: boolean;
  connected: boolean;
};

export default function PostgresIntegrationCard({ orgId, isAdmin, connected }: Props) {
  const [connecting, setConnecting] = useState(false);
  const [testing, setTesting] = useState(false);
  const [host, setHost] = useState("");
  const [port, setPort] = useState("5432");
  const [database, setDatabase] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [table, setTable] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  async function handleConnect() {
    if (!isAdmin || !host || !database || !username || !password) return;
    setConnecting(true);
    setMsg(null);
    try {
      const res = await fetch("/api/integrations/postgres-readonly/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orgId,
          host,
          port: parseInt(port, 10) || 5432,
          database,
          username,
          password,
          table: table || undefined,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok) {
        setMsg("Connected");
        setTimeout(() => window.location.reload(), 800);
      } else {
        setMsg((json as { error?: string }).error ?? "Connection failed");
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
      const res = await fetch("/api/integrations/postgres_readonly/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok && (json as { ok?: boolean }).ok) {
        setMsg("Connection successful");
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
            {connected ? "Connected" : "Connect PostgreSQL"}
          </div>
          {isAdmin && (
            <>
              {!connected && (
                <p className="text-xs text-[var(--text-muted)]">
                  Enter connection details. Credentials are stored encrypted.
                </p>
              )}
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-xs text-[var(--text-muted)]">Host</label>
                  <Input value={host} onChange={(e) => setHost(e.target.value)} placeholder="localhost" />
                </div>
                <div>
                  <label className="text-xs text-[var(--text-muted)]">Port</label>
                  <Input value={port} onChange={(e) => setPort(e.target.value)} placeholder="5432" type="number" />
                </div>
                <div>
                  <label className="text-xs text-[var(--text-muted)]">Database</label>
                  <Input value={database} onChange={(e) => setDatabase(e.target.value)} placeholder="mydb" />
                </div>
                <div>
                  <label className="text-xs text-[var(--text-muted)]">Username</label>
                  <Input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="user" />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-xs text-[var(--text-muted)]">Password {connected ? "(leave blank to keep)" : "(required)"}</label>
                  <Input value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder="••••••••" />
                </div>
                <div>
                  <label className="text-xs text-[var(--text-muted)]">Table (optional)</label>
                  <Input value={table} onChange={(e) => setTable(e.target.value)} placeholder="customers" />
                </div>
              </div>
              <div className="flex gap-2">
                <Button onClick={handleConnect} disabled={connecting || (!connected && (!host || !database || !username || !password))}>
                  {connecting ? "Connecting…" : connected ? "Update" : "Connect"}
                </Button>
                {connected && (
                  <Button variant="outline" onClick={handleTest} disabled={testing}>
                    {testing ? "Testing…" : "Test"}
                  </Button>
                )}
              </div>
              {connected && (
                <IntegrationSetupActions orgId={orgId} provider="postgres_readonly" connected onTest={handleTest} testing={testing} />
              )}
            </>
          )}
          {msg && <p className="text-sm text-[var(--text-muted)]">{msg}</p>}
        </Stack>
      </CardBody>
    </Card>
  );
}
