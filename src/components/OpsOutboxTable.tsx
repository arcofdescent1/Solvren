"use client";

import { useState } from "react";
import { Button, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/ui";

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

  if (rows.length === 0) return <p className="text-sm text-[var(--text-muted)]">None</p>;

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Channel</TableHead>
          <TableHead>Template</TableHead>
          <TableHead>Attempts</TableHead>
          <TableHead>Last error</TableHead>
          <TableHead />
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => (
          <TableRow key={r.id}>
            <TableCell>{r.channel}</TableCell>
            <TableCell>{r.template_key}</TableCell>
            <TableCell>{r.attempt_count ?? 0}</TableCell>
            <TableCell className="max-w-[420px]">
              <span className="block truncate text-xs text-[var(--text-muted)]" title={r.last_error ?? ""}>
                {r.last_error ?? ""}
              </span>
            </TableCell>
            <TableCell className="text-right">
              <Button size="sm" onClick={() => void retry(r.id)} disabled={busyId === r.id}>
                {busyId === r.id ? "Retrying..." : "Retry"}
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
