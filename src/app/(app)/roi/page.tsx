import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getActiveOrg } from "@/lib/org/activeOrg";
import { canViewRoiDashboard } from "@/lib/issues/verification/canViewRoiDashboard";
import { PageHeaderV2, Card, CardBody, Stack } from "@/ui";

function fmtMoney(cents: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(
    cents / 100
  );
}

export default async function RoiDashboardPage() {
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  const userId = userRes.user?.id;
  if (!userId) redirect("/login");

  const { activeOrgId } = await getActiveOrg(supabase, userId);
  if (!activeOrgId) notFound();

  const allowed = await canViewRoiDashboard(supabase, userId, activeOrgId);
  if (!allowed) notFound();

  const start = new Date();
  start.setUTCDate(1);
  start.setUTCHours(0, 0, 0, 0);

  const { data: events } = await supabase
    .from("roi_events")
    .select("roi_type, actual_value_cents, estimated_value_cents, confidence, explanation, created_at, issue_id")
    .eq("org_id", activeOrgId)
    .gte("created_at", start.toISOString())
    .order("created_at", { ascending: false })
    .limit(20);

  let recovered = 0;
  let prevented = 0;
  let efficiency = 0;
  for (const e of events ?? []) {
    const v = Number((e as { actual_value_cents?: number | null }).actual_value_cents ?? 0) || 0;
    const t = String((e as { roi_type?: string }).roi_type ?? "");
    if (t === "recovered_revenue") recovered += v;
    else if (t === "prevented_loss") prevented += v;
    else if (t === "efficiency_gain") efficiency += v;
  }

  return (
    <Stack gap={6}>
      <PageHeaderV2
        breadcrumbs={[{ label: "Home", href: "/dashboard" }, { label: "Value delivered" }]}
        title="Value delivered (Phase 4)"
        description="Recovered revenue and verification outcomes for your organization. Month-to-date (UTC)."
        actions={
          <Link href="/executive" className="text-sm font-semibold text-[var(--primary)] hover:underline">
            Executive
          </Link>
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardBody>
            <p className="text-xs font-medium uppercase text-[var(--text-muted)]">Recovered revenue (MTD)</p>
            <p className="mt-2 text-2xl font-bold">{fmtMoney(recovered)}</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <p className="text-xs font-medium uppercase text-[var(--text-muted)]">Prevented loss (MTD)</p>
            <p className="mt-2 text-2xl font-bold">{fmtMoney(prevented)}</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <p className="text-xs font-medium uppercase text-[var(--text-muted)]">Efficiency gains (MTD)</p>
            <p className="mt-2 text-2xl font-bold">{fmtMoney(efficiency)}</p>
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardBody>
          <p className="text-sm font-semibold">Recent ROI events</p>
          {(!events || events.length === 0) && (
            <p className="mt-2 text-sm text-[var(--text-muted)]">No ROI events this month yet.</p>
          )}
          <ul className="mt-3 space-y-2 text-sm">
            {(events ?? []).map((row) => {
              const e = row as {
                id?: string;
                actual_value_cents?: number | null;
                estimated_value_cents?: number;
                confidence?: string;
                explanation?: string;
                created_at?: string;
                issue_id?: string;
              };
              return (
                <li key={String(e.issue_id) + String(e.created_at)} className="border-b border-[var(--border)] pb-2">
                  <p className="font-medium">{fmtMoney(Number(e.actual_value_cents ?? 0))} actual</p>
                  <p className="text-xs text-[var(--text-muted)]">
                    Est. {fmtMoney(Number(e.estimated_value_cents ?? 0))} · {e.confidence} ·{" "}
                    {e.created_at ? new Date(e.created_at).toLocaleString() : ""}
                  </p>
                  {e.explanation ? <p className="mt-1 text-[var(--text-muted)]">{e.explanation}</p> : null}
                  {e.issue_id ? (
                    <Link
                      href={`/executive/value-issues/${e.issue_id}`}
                      className="text-xs text-[var(--primary)] hover:underline"
                    >
                      View issue
                    </Link>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </CardBody>
      </Card>
    </Stack>
  );
}
