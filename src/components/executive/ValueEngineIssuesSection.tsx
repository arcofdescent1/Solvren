import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getActiveOrg } from "@/lib/org/activeOrg";
import { Card, CardBody, CardHeader, CardTitle, Table, TableHeader, TableBody, TableRow, TableHead, TableCell, Badge } from "@/ui";

function formatMoneyCents(n: number, currency: string) {
  const cur = currency?.toLowerCase() === "usd" ? "USD" : currency?.toUpperCase() ?? "USD";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: cur, maximumFractionDigits: 0 }).format(
    n / 100
  );
}

export default async function ValueEngineIssuesSection() {
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  const userId = userRes.user?.id;
  if (!userId) return null;

  const { activeOrgId } = await getActiveOrg(supabase, userId);
  if (!activeOrgId) return null;

  const { data: issues } = await supabase
    .from("issues")
    .select(
      "id, title, revenue_impact_cents, currency, affected_count, detection_source, opened_at, status, severity, detection_confidence"
    )
    .eq("org_id", activeOrgId)
    .eq("source_type", "detector")
    .neq("status", "dismissed")
    .order("opened_at", { ascending: false })
    .limit(25);

  const rows = (issues ?? []) as Array<{
    id: string;
    title: string;
    revenue_impact_cents: number;
    currency: string;
    affected_count: number;
    detection_source: string | null;
    opened_at: string;
    status: string;
    severity: string;
    detection_confidence: string | null;
  }>;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <div>
          <CardTitle>Detection issues</CardTitle>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Revenue-impacting findings from connected integrations (unified issues model).
          </p>
        </div>
        <Link href="/signals" className="text-sm font-semibold text-[var(--primary)] hover:underline shrink-0">
          Signals overview →
        </Link>
      </CardHeader>
      <CardBody>
        {rows.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)]">
            No issues yet. Connect Stripe or HubSpot under Settings → Integrations. We’ll surface more as we analyze
            additional data.
          </p>
        ) : rows.length < 3 ? (
          <p className="mb-3 text-sm text-[var(--text-muted)]">
            Showing {rows.length} issue{rows.length === 1 ? "" : "s"}. We’ll surface more as we analyze additional data.
          </p>
        ) : null}

        {rows.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Impact</TableHead>
                <TableHead>Affected</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Severity</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <Link href={`/executive/value-issues/${r.id}`} className="font-medium text-[var(--primary)] hover:underline">
                      {r.title}
                    </Link>
                  </TableCell>
                  <TableCell>{formatMoneyCents(r.revenue_impact_cents, r.currency)}</TableCell>
                  <TableCell>{r.affected_count}</TableCell>
                  <TableCell className="capitalize">{r.detection_source ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant={r.severity === "high" ? "danger" : r.severity === "medium" ? "warning" : "secondary"}>
                      {r.severity}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-[var(--text-muted)]">
                    {new Date(r.opened_at).toLocaleDateString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : null}
      </CardBody>
    </Card>
  );
}
