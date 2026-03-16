import { headers } from "next/headers";
import Link from "next/link";
import {
  PageHeader,
  Card,
  CardBody,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  Badge,
} from "@/ui";
import { getActiveOrg } from "@/lib/org/activeOrg";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

function riskBadge(bucket: string) {
  const v = bucket?.toUpperCase();
  if (v === "CRITICAL") return <Badge variant="danger">Critical</Badge>;
  if (v === "HIGH") return <Badge className="bg-amber-600">High</Badge>;
  if (v === "MODERATE") return <Badge variant="secondary">Moderate</Badge>;
  return <Badge variant="outline">Low</Badge>;
}

export default async function RiskAuditPage() {
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes?.user) redirect("/login");

  const { activeOrgId, memberships } = await getActiveOrg(supabase, userRes.user.id);
  if (!activeOrgId || !memberships.find((m) => m.orgId === activeOrgId)) {
    return (
      <div className="space-y-4">
        <PageHeader breadcrumbs={[{ label: "Overview", href: "/dashboard" }, { label: "Risks" }]} title="Revenue Risks" />
        <Card><CardBody><p className="text-sm text-[var(--text-muted)]">No organization selected.</p></CardBody></Card>
      </div>
    );
  }

  const h = await headers();
  const base = `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host") ?? "localhost:3000"}`;
  const res = await fetch(`${base}/api/risk-events?orgId=${activeOrgId}&days=30`, { cache: "no-store" });
  const data = (await res.json().catch(() => ({}))) as { ok?: boolean; events?: Array<{ id: string; provider: string; object: string; object_id: string; field?: string; risk_type: string; risk_bucket: string; actor?: string; timestamp: string; approved_at?: string }> };
  const events = data.events ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={[{ label: "Overview", href: "/dashboard" }, { label: "Risks" }]}
        title="Revenue Risks"
        description="Risk events, investigation details, and linked changes"
      />

      <Card>
        <CardBody className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Provider</TableHead>
                <TableHead>Event</TableHead>
                <TableHead>Actor</TableHead>
                <TableHead>Risk</TableHead>
                <TableHead>Approval</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {events.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="text-sm text-[var(--text-muted)]">{new Date(e.timestamp).toLocaleDateString()}</TableCell>
                  <TableCell>{e.provider}</TableCell>
                  <TableCell>{e.object} {e.field ? `· ${e.field}` : ""}</TableCell>
                  <TableCell>{e.actor ?? "—"}</TableCell>
                  <TableCell>{riskBadge(e.risk_bucket)}</TableCell>
                  <TableCell>{e.approved_at ? "Granted" : "Missing"}</TableCell>
                  <TableCell><Link href={`/risk/event/${e.id}`} className="text-sm text-[var(--primary)]">View</Link></TableCell>
                </TableRow>
              ))}
              {events.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="py-8 text-center text-[var(--text-muted)]">
                    No revenue risks detected yet. Once monitoring is active, risks will appear here automatically.
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
