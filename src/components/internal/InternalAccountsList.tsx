"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/ui/layout/page-header";
import { Stack } from "@/ui/layout/stack";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/ui/primitives/table";
import { Button } from "@/ui/primitives/button";

type Row = {
  orgId: string;
  name: string;
  slug: string | null;
  plan: string;
  billingStatus: string | null;
  onboardingPhaseSummary: string;
  memberCount: number;
  pendingInviteCount: number;
  integrationCount: number;
  lastActivityAt: string;
};

export function InternalAccountsList() {
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const pageSize = 25;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/internal/accounts?page=${page}&pageSize=${pageSize}`, { cache: "no-store" });
      if (!res.ok) {
        setError(await res.text());
        return;
      }
      const data = (await res.json()) as { items: Row[]; total: number };
      setRows(data.items);
      setTotal(data.total);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <Stack gap={6}>
      <PageHeader title="Accounts" description="Search and open customer organizations." />
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <div className="flex gap-2">
        <Button type="button" variant="outline" size="sm" disabled={page <= 1 || loading} onClick={() => setPage((p) => p - 1)}>
          Previous
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={loading || page * pageSize >= total}
          onClick={() => setPage((p) => p + 1)}
        >
          Next
        </Button>
        <span className="text-sm text-muted-foreground self-center">
          Page {page} · {total} orgs
        </span>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Plan</TableHead>
            <TableHead>Billing</TableHead>
            <TableHead>Onboarding</TableHead>
            <TableHead>Members</TableHead>
            <TableHead>Pending invites</TableHead>
            <TableHead>Integrations</TableHead>
            <TableHead>Last activity</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            <TableRow>
              <TableCell colSpan={8}>
                Loading…
              </TableCell>
            </TableRow>
          ) : (
            rows.map((r) => (
              <TableRow key={r.orgId}>
                <TableCell>
                  <Link className="text-[var(--primary)] hover:underline font-medium" href={`/internal/accounts/${r.orgId}`}>
                    {r.name}
                  </Link>
                  {r.slug ? <div className="text-xs text-muted-foreground">{r.slug}</div> : null}
                </TableCell>
                <TableCell>{r.plan}</TableCell>
                <TableCell>{r.billingStatus ?? "—"}</TableCell>
                <TableCell>{r.onboardingPhaseSummary}</TableCell>
                <TableCell>{r.memberCount}</TableCell>
                <TableCell>{r.pendingInviteCount}</TableCell>
                <TableCell>{r.integrationCount}</TableCell>
                <TableCell className="whitespace-nowrap text-xs">{new Date(r.lastActivityAt).toLocaleString()}</TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </Stack>
  );
}
