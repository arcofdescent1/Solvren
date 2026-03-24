"use client";

import { useState } from "react";
import { Button, Card, CardBody, Input, Stack } from "@/ui";
import { IntegrationSetupActions } from "./IntegrationSetupActions";

type Props = {
  orgId: string;
  isAdmin: boolean;
  connected: boolean;
};

export default function BigQueryIntegrationCard({ orgId, isAdmin, connected }: Props) {
  const [connecting, setConnecting] = useState(false);
  const [testing, setTesting] = useState(false);
  const [projectId, setProjectId] = useState("");
  const [credentialsJson, setCredentialsJson] = useState("");
  const [dataset, setDataset] = useState("");
  const [table, setTable] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  async function handleConnect() {
    if (!isAdmin || !projectId || !credentialsJson.trim()) return;
    setConnecting(true);
    setMsg(null);
    try {
      const res = await fetch("/api/integrations/bigquery/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orgId,
          projectId,
          credentialsJson: credentialsJson.trim(),
          dataset: dataset || undefined,
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
      const res = await fetch("/api/integrations/bigquery/test", {
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
            {connected ? "Connected" : "Connect BigQuery"}
          </div>
          {isAdmin && (
            <>
              {!connected && (
                <p className="text-xs text-[var(--text-muted)]">
                  Paste your GCP service account JSON key. Create one in GCP Console → IAM → Service Accounts.
                </p>
              )}
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-xs text-[var(--text-muted)]">Project ID</label>
                  <Input value={projectId} onChange={(e) => setProjectId(e.target.value)} placeholder="my-gcp-project" />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-xs text-[var(--text-muted)]">Service Account JSON {connected ? "(leave blank to keep)" : "(required)"}</label>
                  <textarea
                    value={credentialsJson}
                    onChange={(e) => setCredentialsJson(e.target.value)}
                    placeholder='{"type":"service_account","project_id":"..."}'
                    rows={4}
                    className="w-full rounded border border-[var(--border)] bg-[var(--bg)] px-3 py-2 font-mono text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-[var(--text-muted)]">Dataset (optional)</label>
                  <Input value={dataset} onChange={(e) => setDataset(e.target.value)} placeholder="my_dataset" />
                </div>
                <div>
                  <label className="text-xs text-[var(--text-muted)]">Table (optional)</label>
                  <Input value={table} onChange={(e) => setTable(e.target.value)} placeholder="customers" />
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={handleConnect}
                  disabled={connecting || (!connected && (!projectId || !credentialsJson.trim()))}
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
                <IntegrationSetupActions orgId={orgId} provider="bigquery" connected onTest={handleTest} testing={testing} />
              )}
            </>
          )}
          {msg && <p className="text-sm text-[var(--text-muted)]">{msg}</p>}
        </Stack>
      </CardBody>
    </Card>
  );
}
