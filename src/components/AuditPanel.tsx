"use client";;
import { Button } from "@/ui";

import { useEffect, useState } from "react";

export type AuditRow = {
  id: string;
  actor_id: string | null;
  actor_type: string;
  action: string;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type AuditPanelProps = {
  changeId: string;
  initialRows?: AuditRow[] | null;
};

function fmt(ts: string) {
  return new Date(ts).toLocaleString();
}

export default function AuditPanel({ changeId, initialRows }: AuditPanelProps) {
  const [rows, setRows] = useState<AuditRow[]>(initialRows ?? []);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setRows(initialRows ?? []);
  }, [changeId, initialRows]);

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch(
        `/api/audit/list?changeId=${encodeURIComponent(changeId)}`
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error ?? "Failed to load audit");
      setRows(json.rows ?? []);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="border rounded p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Audit</h2>
        <Button
          type="button"
          className="text-sm underline opacity-70"
          onClick={load}
        >
          Refresh
        </Button>
      </div>
      {loading && <div className="text-sm opacity-70">Loading…</div>}
      {err && <div className="text-sm text-red-600">{err}</div>}
      {!loading && !err && rows.length === 0 && (
        <div className="text-sm opacity-70">No audit events yet.</div>
      )}
      {!loading && !err && rows.length > 0 && (
        <div className="space-y-2">
          {rows.map((r) => (
            <div key={r.id} className="border rounded p-2 text-sm">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div className="font-medium">{r.action}</div>
                <div className="text-xs opacity-60">{fmt(r.created_at)}</div>
              </div>
              <div className="text-xs opacity-60 mt-1">
                {r.actor_type}
                {r.actor_id ? ` • ${r.actor_id}` : ""}
              </div>
              {r.metadata && Object.keys(r.metadata).length > 0 && (
                <pre className="mt-2 text-xs whitespace-pre-wrap opacity-80">
                  {JSON.stringify(r.metadata, null, 2)}
                </pre>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
