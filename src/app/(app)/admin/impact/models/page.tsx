"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader, Card, CardBody, Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/ui";

type ImpactModel = {
  id: string;
  modelKey: string;
  modelVersion: string;
  displayName: string;
  issueFamily: string;
  detectorKeys: string[];
  description: string;
  status: string;
};

export default function AdminImpactModelsPage() {
  const [models, setModels] = useState<ImpactModel[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/impact/models")
      .then((r) => r.json())
      .then((d) => {
        const list = (d.models ?? []).map((m: { detector_keys?: string[]; detectorKeys?: string[] }) => ({
          ...m,
          detectorKeys: m.detectorKeys ?? m.detector_keys ?? [],
        }));
        setModels(list);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-4">
        <PageHeader breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Admin" }, { label: "Impact Models" }]} title="Impact Models" />
        <Card><CardBody><p className="text-sm text-[var(--text-muted)]">Loading…</p></CardBody></Card>
      </div>
    );
  }

  return (
    <div className="max-w-5xl space-y-6">
      <PageHeader
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Admin", href: "/admin/domains" },
          { label: "Impact Models" },
        ]}
        title="Impact Models"
        description="Versioned impact models by issue family. Each model estimates economic impact for specific detector findings."
        right={
          <Link href="/admin/impact/assumptions" className="text-sm font-semibold text-[var(--primary)] hover:underline">
            Impact Assumptions →
          </Link>
        }
      />
      <Card>
        <CardBody className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Model</TableHead>
                <TableHead>Family</TableHead>
                <TableHead>Detector keys</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {models.map((m) => (
                <TableRow key={m.id ?? m.modelKey}>
                  <TableCell>
                    <div>
                      <span className="font-medium">{m.displayName}</span>
                      <span className="ml-1 font-mono text-xs text-[var(--text-muted)]">v{m.modelVersion}</span>
                    </div>
                    <p className="mt-1 text-xs text-[var(--text-muted)]">{m.description}</p>
                  </TableCell>
                  <TableCell className="font-mono text-sm">{m.issueFamily}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {(Array.isArray(m.detectorKeys) ? m.detectorKeys : []).map((k: string) => (
                        <span key={k} className="rounded bg-[var(--bg-surface-2)] px-1.5 py-0.5 font-mono text-xs">{k}</span>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className={m.status === "active" ? "text-[var(--success)]" : "text-[var(--text-muted)]"}>{m.status}</span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardBody>
      </Card>
    </div>
  );
}
