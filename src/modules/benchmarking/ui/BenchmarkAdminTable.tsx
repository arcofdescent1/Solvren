"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/ui/primitives/table";

export type BenchmarkSnapshotRow = {
  id: string;
  cohort_id: string;
  metric_id: string;
  snapshot_time: string;
  org_count: number;
  metric_coverage_rate: number;
  median_value: number | null;
  confidence_score: number;
  confidence_band: string;
};

export type BenchmarkAdminTableProps = {
  snapshots: BenchmarkSnapshotRow[];
};

export function BenchmarkAdminTable({ snapshots }: BenchmarkAdminTableProps) {
  if (snapshots.length === 0) {
    return (
      <p className="py-4 text-center text-sm text-[var(--text-muted)]">
        No benchmark snapshots yet.
      </p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Snapshot time</TableHead>
          <TableHead>Org count</TableHead>
          <TableHead>Coverage</TableHead>
          <TableHead>Median</TableHead>
          <TableHead>Confidence</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {snapshots.map((s) => (
          <TableRow key={s.id}>
            <TableCell className="text-sm text-[var(--text-muted)]">
              {new Date(s.snapshot_time).toLocaleString()}
            </TableCell>
            <TableCell>{s.org_count}</TableCell>
            <TableCell>{(s.metric_coverage_rate * 100).toFixed(1)}%</TableCell>
            <TableCell className="font-mono">
              {s.median_value != null ? s.median_value.toFixed(2) : "—"}
            </TableCell>
            <TableCell>
              {s.confidence_band} ({s.confidence_score})
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
