"use client";

import { useCallback, useEffect, useState } from "react";
import { Button, Card, CardBody } from "@/ui";

type PurgeRequest = {
  id: string;
  status: string;
  reason: string;
  legal_hold_active: boolean;
  created_at: string;
  last_dry_run_at: string | null;
};

export default function OrgPurgeClient(props: { orgId: string; orgName: string | null }) {
  const [requests, setRequests] = useState<PurgeRequest[]>([]);
  const [reason, setReason] = useState("");
  const [legalHold, setLegalHold] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [lastPlan, setLastPlan] = useState<unknown>(null);
  const [lastRunId, setLastRunId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/admin/org-purge/requests?orgId=${encodeURIComponent(props.orgId)}`);
    const j = await res.json();
    if (!res.ok) throw new Error(j.error ?? "list failed");
    setRequests(j.requests ?? []);
  }, [props.orgId]);

  useEffect(() => {
    void refresh().catch((e) => setMessage(e instanceof Error ? e.message : String(e)));
  }, [refresh]);

  async function createRequest() {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/org-purge/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orgId: props.orgId,
          reason: reason.trim() || "(no reason provided)",
          legalHoldActive: legalHold,
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "create failed");
      setReason("");
      setLegalHold(false);
      await refresh();
      setMessage(`Request created: ${j.request?.id ?? ""}`);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  async function dryRun(id: string) {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/org-purge/requests/${id}/dry-run`, { method: "POST" });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "dry-run failed");
      setLastPlan(j.plan);
      await refresh();
      setMessage("Dry run complete.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  async function approve(id: string) {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/org-purge/requests/${id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "approve failed");
      await refresh();
      setMessage("Approved.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  async function execute(id: string, resumeRunId?: string) {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/org-purge/requests/${id}/execute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resumeRunId: resumeRunId ?? undefined }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.message ?? j.error ?? "execute failed");
      setLastRunId(j.runId ?? null);
      await refresh();
      setMessage(j.ok ? `Execute finished. Run: ${j.runId}` : `Execute failed: ${j.message}`);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  async function verifyRun(runId: string) {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/org-purge/runs/${runId}/verify`, { method: "POST" });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "verify failed");
      setLastPlan(j.verification);
      setMessage(`Verification allOk=${String(j.verification?.allOk)}`);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardBody className="space-y-3">
          <p className="text-sm text-[var(--muted)]">
            Target organization: <span className="font-mono">{props.orgId}</span>
            {props.orgName ? ` (${props.orgName})` : ""}
          </p>
          <p className="text-sm text-[var(--danger)]">
            Destructive: purges tenant data per Phase 7 policy. Requires dry run, approval, and execute. See runbook in
            docs.
          </p>
          <label className="block text-sm font-medium">Reason</label>
          <textarea
            className="min-h-[80px] w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Why is this org being purged?"
          />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={legalHold} onChange={(e) => setLegalHold(e.target.checked)} />
            Legal / compliance hold active (blocks execution)
          </label>
          <Button type="button" disabled={loading} onClick={() => void createRequest()}>
            Create purge request
          </Button>
        </CardBody>
      </Card>

      {message ? <p className="text-sm">{message}</p> : null}

      <Card>
        <CardBody className="space-y-3">
          <h3 className="text-sm font-semibold">Requests</h3>
          <ul className="space-y-2 text-sm">
            {requests.map((r) => (
              <li key={r.id} className="rounded-md border border-[var(--border)] p-3">
                <div className="font-mono text-xs">{r.id}</div>
                <div>Status: {r.status}</div>
                <div className="flex flex-wrap gap-2 pt-2">
                  <Button type="button" size="sm" variant="secondary" disabled={loading} onClick={() => void dryRun(r.id)}>
                    Dry run
                  </Button>
                  <Button type="button" size="sm" variant="secondary" disabled={loading} onClick={() => void approve(r.id)}>
                    Approve
                  </Button>
                  <Button type="button" size="sm" disabled={loading} onClick={() => void execute(r.id)}>
                    Execute
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </CardBody>
      </Card>

      {lastRunId ? (
        <Card>
          <CardBody>
            <Button type="button" size="sm" disabled={loading} onClick={() => void verifyRun(lastRunId)}>
              Verify run {lastRunId}
            </Button>
          </CardBody>
        </Card>
      ) : null}

      {lastPlan ? (
        <Card>
          <CardBody>
            <pre className="max-h-[420px] overflow-auto text-xs">{JSON.stringify(lastPlan, null, 2)}</pre>
          </CardBody>
        </Card>
      ) : null}
    </div>
  );
}
