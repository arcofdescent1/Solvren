"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { PageHeader, Card, CardBody, Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/ui";

type HistoryRow = {
  id: string;
  assumptionKey: string;
  displayName: string;
  valueJson: Record<string, unknown>;
  valueType: string;
  source: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  notes: string | null;
  createdAt: string;
};

export default function AssumptionHistoryPage() {
  const params = useParams();
  const assumptionKey = params.assumptionKey as string;
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!assumptionKey) return;
    fetch(`/api/admin/impact/assumptions/${encodeURIComponent(assumptionKey)}/history`)
      .then((r) => r.json())
      .then((d) => setHistory(d.history ?? []))
      .finally(() => setLoading(false));
  }, [assumptionKey]);

  const getValue = (v: Record<string, unknown>) => (v?.value ?? v?.number ?? "—") as string | number;

  return (
    <div className="max-w-4xl space-y-6">
      <PageHeader
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Admin", href: "/admin/domains" },
          { label: "Impact Assumptions", href: "/admin/impact/assumptions" },
          { label: assumptionKey ?? "" },
          { label: "History" },
        ]}
        title={`History: ${assumptionKey}`}
        description="Audit log of assumption value changes."
        right={
          <Link href="/admin/impact/assumptions" className="text-sm font-semibold text-[var(--primary)] hover:underline">
            ← Assumptions
          </Link>
        }
      />
      <Card>
        <CardBody className="p-0">
          {loading ? (
            <div className="p-4 text-sm text-[var(--text-muted)]">Loading…</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Value</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Effective from</TableHead>
                  <TableHead>Effective to</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map((h) => (
                  <TableRow key={h.id}>
                    <TableCell>{String(getValue(h.valueJson))}</TableCell>
                    <TableCell>{h.source}</TableCell>
                    <TableCell className="text-sm">{new Date(h.effectiveFrom).toLocaleString()}</TableCell>
                    <TableCell className="text-sm">{h.effectiveTo ? new Date(h.effectiveTo).toLocaleString() : "—"}</TableCell>
                    <TableCell className="text-sm text-[var(--text-muted)]">{new Date(h.createdAt).toLocaleString()}</TableCell>
                  </TableRow>
                ))}
                {history.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-[var(--text-muted)]">No history yet.</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
