"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  PageHeader,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/ui";

function fmtMoney(n: number, code = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: code,
    maximumFractionDigits: 0,
  }).format(n);
}

type ExecutiveSummary = {
  orgId: string;
  openIssueCount: number;
  impactedIssueCount: number;
  totalDirectRealizedLoss: number;
  totalRevenueAtRisk: number;
  totalAvoidedLoss: number;
  totalRecoveredValue: number;
  totalOperationalCost: number;
  currencyCode: string;
  asOf: string;
};

type ByDetectorPack = {
  modelKey: string;
  issueCount: number;
  directRealizedLoss: number;
  revenueAtRisk: number;
  avoidedLoss: number;
  recoveredValue: number;
  operationalCost: number;
};

export default function ExecutiveImpactPage() {
  const [summary, setSummary] = useState<ExecutiveSummary | null>(null);
  const [byPack, setByPack] = useState<ByDetectorPack[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const [summaryRes, packRes] = await Promise.all([
          fetch("/api/reporting/impact/executive-summary"),
          fetch("/api/reporting/impact/by-detector-pack"),
        ]);
        if (!summaryRes.ok) throw new Error((await summaryRes.json()).error ?? "Failed to load");
        if (!packRes.ok) throw new Error((await packRes.json()).error ?? "Failed to load");
        const s = await summaryRes.json();
        const p = await packRes.json();
        if (mounted) {
          setSummary(s);
          setByPack(p.byDetectorPack ?? []);
        }
      } catch (e: unknown) {
        if (mounted) setErr(e instanceof Error ? e.message : "Failed to load");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  if (loading) {
    return (
      <div className="space-y-4">
        <PageHeader breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }]} title="Impact Dashboard" />
        <Card>
          <CardBody>
            <p className="text-sm text-[var(--text-muted)]">Loading…</p>
          </CardBody>
        </Card>
      </div>
    );
  }
  if (err) {
    return (
      <div className="space-y-4">
        <PageHeader breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }]} title="Impact Dashboard" />
        <Card className="border-[var(--danger)]/50">
          <CardBody>
            <p className="text-sm text-[var(--danger)]">{err}</p>
          </CardBody>
        </Card>
      </div>
    );
  }

  const s = summary!;
  const code = s.currencyCode ?? "USD";

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Executive", href: "/executive" },
          { label: "Impact" },
        ]}
        title="Impact Quantification"
        description="Open risk, realized loss, and operational cost from detected issues."
        right={
          <div className="flex gap-3">
            <Link href="/issues" className="text-sm font-semibold text-[var(--primary)] hover:underline">
              Issues →
            </Link>
            <Link href="/dashboard" className="text-sm font-semibold text-[var(--primary)] hover:underline">
              Dashboard
            </Link>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardBody>
            <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">Direct realized loss</p>
            <p className="mt-2 text-2xl font-bold text-[var(--danger)]">{fmtMoney(s.totalDirectRealizedLoss, code)}</p>
            <p className="mt-1 text-xs text-[var(--text-muted)]">Already incurred</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">Revenue at risk</p>
            <p className="mt-2 text-2xl font-bold text-[var(--text)]">{fmtMoney(s.totalRevenueAtRisk, code)}</p>
            <p className="mt-1 text-xs text-[var(--text-muted)]">If unresolved</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">Avoided loss</p>
            <p className="mt-2 text-2xl font-bold text-[var(--success)]">{fmtMoney(s.totalAvoidedLoss, code)}</p>
            <p className="mt-1 text-xs text-[var(--text-muted)]">Through intervention</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">Recovered value</p>
            <p className="mt-2 text-2xl font-bold text-[var(--success)]">{fmtMoney(s.totalRecoveredValue, code)}</p>
            <p className="mt-1 text-xs text-[var(--text-muted)]">Post remediation</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">Operational cost</p>
            <p className="mt-2 text-2xl font-bold text-[var(--text)]">{fmtMoney(s.totalOperationalCost, code)}</p>
            <p className="mt-1 text-xs text-[var(--text-muted)]">Labor / process burden</p>
          </CardBody>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card>
          <CardBody>
            <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">Open issues</p>
            <p className="mt-2 text-2xl font-bold text-[var(--text)]">{s.openIssueCount}</p>
            <p className="mt-1 text-xs text-[var(--text-muted)]">With impact assessed: {s.impactedIssueCount}</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">As of</p>
            <p className="mt-2 text-lg font-semibold text-[var(--text)]">
              {new Date(s.asOf).toLocaleString()}
            </p>
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>By detector pack / model</CardTitle>
        </CardHeader>
        <CardBody className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Model</TableHead>
                <TableHead>Issues</TableHead>
                <TableHead>Direct loss</TableHead>
                <TableHead>Revenue at risk</TableHead>
                <TableHead>Avoided</TableHead>
                <TableHead>Recovered</TableHead>
                <TableHead>Op cost</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {byPack.map((row) => (
                <TableRow key={row.modelKey}>
                  <TableCell className="font-mono text-sm">{row.modelKey}</TableCell>
                  <TableCell>{row.issueCount}</TableCell>
                  <TableCell>{fmtMoney(row.directRealizedLoss, code)}</TableCell>
                  <TableCell>{fmtMoney(row.revenueAtRisk, code)}</TableCell>
                  <TableCell>{fmtMoney(row.avoidedLoss, code)}</TableCell>
                  <TableCell>{fmtMoney(row.recoveredValue, code)}</TableCell>
                  <TableCell>{fmtMoney(row.operationalCost, code)}</TableCell>
                </TableRow>
              ))}
              {byPack.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-[var(--text-muted)]">
                    No impact data yet. Create issues from detector findings to see impact by model.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardBody>
      </Card>
    </div>
  );
}
