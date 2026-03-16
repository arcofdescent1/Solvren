"use client";

import { useState } from "react";
import { Button } from "@/ui";
import { DataTable, TD, TH, TR } from "@/components/ui/DataTable";

type Row = {
  id: string;
  channel: string | null;
  template_key: string | null;
  status: string | null;
  attempt_count: number | null;
  last_error: string | null;
  created_at: string | null;
};

export default function OpsOutboxTable(props: { rows: Row[] }) {
  const { rows } = props;
  const [busyId, setBusyId] = useState<string | null>(null);

  async function retry(id: string) {
    setBusyId(id);
    try {
      await fetch("/api/notifications/retry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ outboxId: id }),
      });
      window.location.reload();
    } finally {
      setBusyId(null);
    }
  }

  if (rows.length === 0) {
    return (
      <p className="text-[13px] text-[color:var(--rg-muted)]">None 🎉</p>
    );
  }

  return (
    <div className="rounded-[var(--rg-radius)] border border-[color:var(--rg-border)] bg-[color:var(--rg-panel)] overflow-hidden">
      <DataTable>
        <thead className="bg-[color:var(--rg-panel-2)]">
          <tr>
            <TH>Channel</TH>
            <TH>Template</TH>
            <TH>Attempts</TH>
            <TH>Last error</TH>
            <TH />
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <TR key={r.id}>
              <TD>{r.channel}</TD>
              <TD>{r.template_key}</TD>
              <TD>{r.attempt_count ?? 0}</TD>
              <TD className="max-w-[420px]">
                <span
                  className="block text-[12px] text-[color:var(--rg-muted)] truncate"
                  title={r.last_error ?? ""}
                >
                  {r.last_error ?? ""}
                </span>
              </TD>
              <TD className="text-right">
                <Button
                  size="sm"
                  onClick={() => void retry(r.id)}
                  disabled={busyId === r.id}
                >
                  {busyId === r.id ? "Retrying…" : "Retry"}
                </Button>
              </TD>
            </TR>
          ))}
        </tbody>
      </DataTable>
    </div>
  );
}
