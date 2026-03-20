"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/ui/primitives/table";
import { Badge } from "@/ui";

export type DecisionLogSummary = {
  id: string;
  created_at: string;
  selected_action_key: string | null;
  result_status: string;
  decision_model_version: string | null;
  used_cold_start?: boolean;
};

export type DecisionHistoryTableProps = {
  logs: DecisionLogSummary[];
  onSelectLog?: (id: string) => void;
};

export function DecisionHistoryTable({ logs, onSelectLog }: DecisionHistoryTableProps) {
  if (logs.length === 0) {
    return (
      <p className="py-4 text-center text-sm text-[var(--text-muted)]">
        No decision history for this issue.
      </p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Time</TableHead>
          <TableHead>Selected action</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Model</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {logs.map((log) => (
          <TableRow
            key={log.id}
            className={onSelectLog ? "cursor-pointer hover:bg-[var(--bg-surface-2)]" : undefined}
            onClick={() => onSelectLog?.(log.id)}
          >
            <TableCell className="text-sm text-[var(--text-muted)]">
              {new Date(log.created_at).toLocaleString()}
            </TableCell>
            <TableCell className="font-medium">
              {log.selected_action_key ?? "—"}
            </TableCell>
            <TableCell>
              <Badge
                variant={
                  log.result_status === "RANKED"
                    ? "default"
                    : log.result_status === "NO_ELIGIBLE_ACTION"
                      ? "secondary"
                      : "outline"
                }
              >
                {log.result_status}
              </Badge>
            </TableCell>
            <TableCell className="text-sm text-[var(--text-muted)]">
              {log.decision_model_version ? `v${log.decision_model_version}` : "—"}
              {log.used_cold_start && " (cold-start)"}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
