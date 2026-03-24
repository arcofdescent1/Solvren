"use client";

import { useState } from "react";
import { Button, Card, CardBody, Input, Stack } from "@/ui";
import { IntegrationSetupActions } from "./IntegrationSetupActions";

type Props = {
  orgId: string;
  isAdmin: boolean;
  connected: boolean;
};

export default function SnowflakeIntegrationCard({ orgId, isAdmin, connected }: Props) {
  const [connecting, setConnecting] = useState(false);
  const [testing, setTesting] = useState(false);
  const [account, setAccount] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [database, setDatabase] = useState("");
  const [schema, setSchema] = useState("PUBLIC");
  const [warehouse, setWarehouse] = useState("");
  const [table, setTable] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  async function handleConnect() {
    if (!isAdmin || !account || !username || !password || !database || !warehouse) return;
    setConnecting(true);
    setMsg(null);
    try {
      const res = await fetch("/api/integrations/snowflake/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orgId,
          account,
          username,
          password,
          database,
          schema: schema || "PUBLIC",
          warehouse,
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
      const res = await fetch("/api/integrations/snowflake/test", {
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
            {connected ? "Connected" : "Connect Snowflake"}
          </div>
          {isAdmin && (
            <>
              {!connected && (
                <p className="text-xs text-[var(--text-muted)]">
                  Enter Snowflake connection details. Use account identifier (e.g. xy12345.us-east-1).
                </p>
              )}
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-xs text-[var(--text-muted)]">Account</label>
                  <Input value={account} onChange={(e) => setAccount(e.target.value)} placeholder="xy12345.us-east-1" />
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
                  <label className="text-xs text-[var(--text-muted)]">Database</label>
                  <Input value={database} onChange={(e) => setDatabase(e.target.value)} placeholder="MY_DB" />
                </div>
                <div>
                  <label className="text-xs text-[var(--text-muted)]">Schema</label>
                  <Input value={schema} onChange={(e) => setSchema(e.target.value)} placeholder="PUBLIC" />
                </div>
                <div>
                  <label className="text-xs text-[var(--text-muted)]">Warehouse</label>
                  <Input value={warehouse} onChange={(e) => setWarehouse(e.target.value)} placeholder="COMPUTE_WH" />
                </div>
                <div>
                  <label className="text-xs text-[var(--text-muted)]">Table (optional)</label>
                  <Input value={table} onChange={(e) => setTable(e.target.value)} placeholder="CUSTOMERS" />
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={handleConnect}
                  disabled={
                    connecting ||
                    (!connected && (!account || !username || !password || !database || !warehouse))
                  }
                >
                  {connecting ? "Connecting…" : connected ? "Update" : "Connect"}
                </Button>
                {connected && (
                  <Button variant="outline" onClick={handleTest} disabled={testing}>
                    {testing ? "Testing…" : "Test"}
                  </Button>
                )}
              </div>
              {connected && (
                <IntegrationSetupActions orgId={orgId} provider="snowflake" connected onTest={handleTest} testing={testing} />
              )}
            </>
          )}
          {msg && <p className="text-sm text-[var(--text-muted)]">{msg}</p>}
        </Stack>
      </CardBody>
    </Card>
  );
}
