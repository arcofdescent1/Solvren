import Link from "next/link";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { ActionQueueNextCell } from "@/components/issues/ActionQueueNextCell";
import { PageHeaderV2, Card, CardBody, CardHeader, CardTitle, Table, TableHeader, TableBody, TableRow, TableHead, TableCell, Badge } from "@/ui";
import { OPEN_ISSUE_QUEUE_STATUSES } from "@/lib/issues/issuePhase2Types";

function formatMoneyCents(n: number, currency: string) {
  const cur = currency?.toLowerCase() === "usd" ? "USD" : currency?.toUpperCase() ?? "USD";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: cur, maximumFractionDigits: 0 }).format(
    n / 100
  );
}

export default async function ActionQueuePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) redirect("/login");

  const { data: membership } = await supabase
    .from("organization_members")
    .select("org_id")
    .eq("user_id", userRes.user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!membership?.org_id) redirect("/onboarding");

  const params = await searchParams;
  const approvalParam = typeof params.approval === "string" ? params.approval : "any";
  const slaParam = typeof params.sla === "string" ? params.sla : "any";

  let q = supabase
    .from("issues")
    .select(
      "id, title, status, approval_state, owner_user_id, severity, sla_due_at, revenue_impact_cents, currency, opened_at, source_type"
    )
    .eq("org_id", membership.org_id)
    .in("status", OPEN_ISSUE_QUEUE_STATUSES);

  if (approvalParam === "pending") {
    q = q.eq("approval_state", "pending");
  }
  if (slaParam === "due_soon") {
    const soon = new Date(Date.now() + 86400000).toISOString();
    const now = new Date().toISOString();
    q = q.not("sla_due_at", "is", null).lte("sla_due_at", soon).gte("sla_due_at", now);
  }
  if (slaParam === "breached") {
    q = q.not("sla_due_at", "is", null).lte("sla_due_at", new Date().toISOString());
  }

  const { data: issues } = await q.order("opened_at", { ascending: false }).limit(100);

  const rows = (issues ?? []) as Array<{
    id: string;
    title: string;
    status: string;
    approval_state: string | null;
    owner_user_id: string | null;
    severity: string | null;
    sla_due_at: string | null;
    revenue_impact_cents: number;
    currency: string;
    opened_at: string;
    source_type: string | null;
  }>;

  const base = "/action-queue";

  return (
    <div className="space-y-6">
      <PageHeaderV2
        breadcrumbs={[{ label: "Action queue" }]}
        title="Action queue"
        description="Detector issues that need ownership, approval, or SLA follow-up."
        actions={
          <Link href="/executive" className="text-sm font-semibold text-[var(--primary)] hover:underline">
            Executive summary →
          </Link>
        }
      />

      <div className="flex flex-wrap gap-2 text-sm">
        <Link
          href={base}
          className={`rounded-md border px-3 py-1 ${approvalParam === "any" && slaParam === "any" ? "border-[var(--primary)] bg-[var(--bg-surface-2)]" : "border-[var(--border)]"}`}
        >
          All open
        </Link>
        <Link
          href={`${base}?approval=pending`}
          className={`rounded-md border px-3 py-1 ${approvalParam === "pending" ? "border-[var(--primary)] bg-[var(--bg-surface-2)]" : "border-[var(--border)]"}`}
        >
          Approval pending
        </Link>
        <Link
          href={`${base}?sla=due_soon`}
          className={`rounded-md border px-3 py-1 ${slaParam === "due_soon" ? "border-[var(--primary)] bg-[var(--bg-surface-2)]" : "border-[var(--border)]"}`}
        >
          SLA due &lt; 24h
        </Link>
        <Link
          href={`${base}?sla=breached`}
          className={`rounded-md border px-3 py-1 ${slaParam === "breached" ? "border-[var(--primary)] bg-[var(--bg-surface-2)]" : "border-[var(--border)]"}`}
        >
          SLA breached
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Issues</CardTitle>
        </CardHeader>
        <CardBody className="p-0">
          {rows.length === 0 ? (
            <p className="p-6 text-sm text-[var(--text-muted)]">No matching issues.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Approval</TableHead>
                  <TableHead>Impact</TableHead>
                  <TableHead>SLA</TableHead>
                  <TableHead>Next step</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="max-w-md font-medium">
                      <Link href={`/issues/${r.id}`} className="text-[var(--primary)] hover:underline">
                        {r.title || "Untitled"}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{r.status}</Badge>
                    </TableCell>
                    <TableCell>
                      {r.approval_state ? <Badge variant="secondary">{r.approval_state}</Badge> : "—"}
                    </TableCell>
                    <TableCell>{formatMoneyCents(r.revenue_impact_cents ?? 0, r.currency ?? "usd")}</TableCell>
                    <TableCell className="text-xs text-[var(--text-muted)]">
                      {r.sla_due_at ? new Date(r.sla_due_at).toLocaleString() : "—"}
                    </TableCell>
                    <TableCell className="align-top">
                      <ActionQueueNextCell
                        id={r.id}
                        status={r.status}
                        approval_state={r.approval_state}
                        owner_user_id={r.owner_user_id}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
