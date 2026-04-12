import { createServerSupabaseClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  PageHeader,
  Card,
  CardBody,
  Badge,
} from "@/ui";
import { RiskExplanationPanel } from "@/components/ai/RiskExplanationPanel";
import { Phase3RiskAlertViewedTracker } from "@/components/onboarding/phase3/Phase3RiskAlertViewedTracker";

function riskBadge(bucket: string) {
  const v = bucket?.toUpperCase();
  if (v === "CRITICAL") return <Badge variant="danger">Critical</Badge>;
  if (v === "HIGH") return <Badge className="bg-amber-600">High</Badge>;
  if (v === "MODERATE") return <Badge variant="secondary">Moderate</Badge>;
  return <Badge variant="outline">Low</Badge>;
}

function formatMoney(n: number) {
  if (!Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

function formatJson(val: unknown): string {
  if (val == null) return "—";
  if (typeof val === "object") return JSON.stringify(val, null, 2);
  return String(val);
}

type RiskEventRow = {
  id: string;
  org_id: string;
  provider: string;
  object: string;
  object_id: string;
  field: string | null;
  old_value: unknown;
  new_value: unknown;
  timestamp: string;
  actor: string | null;
  risk_type: string;
  risk_score: number;
  risk_bucket: string;
  impact_amount: number | null;
  change_event_id: string | null;
  approved_at: string | null;
  metadata: unknown;
  created_at: string;
};

export default async function RiskEventDetailPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes?.user) redirect("/login");

  const { data: event, error } = await supabase
    .from("risk_events")
    .select("*")
    .eq("id", eventId)
    .single();

  if (error || !event) {
    return (
      <div className="space-y-4">
        <PageHeader
          breadcrumbs={[
            { label: "Overview", href: "/dashboard" },
            { label: "Revenue Risks", href: "/dashboard/executive-risk" },
            { label: "Revenue Risk Detected" },
          ]}
          title="Event not found"
        />
        <Card>
          <CardBody>
            <p className="text-sm text-[var(--text-muted)]">The requested risk event could not be found.</p>
            <Link href="/dashboard/executive-risk" className="mt-2 block text-sm font-semibold text-[var(--primary)] hover:underline">
              ← Back to Revenue Risks
            </Link>
          </CardBody>
        </Card>
      </div>
    );
  }

  const row = event as RiskEventRow;

  // Check org membership (RLS handles read, but we redirect if no org)
  const { data: member } = await supabase
    .from("organization_members")
    .select("org_id")
    .eq("org_id", row.org_id)
    .eq("user_id", userRes.user.id)
    .maybeSingle();

  if (!member) {
    return (
      <div className="space-y-4">
        <PageHeader
          breadcrumbs={[
            { label: "Overview", href: "/dashboard" },
            { label: "Revenue Risks", href: "/dashboard/executive-risk" },
            { label: "Revenue Risk Detected" },
          ]}
          title="Access denied"
        />
        <Card>
          <CardBody>
            <p className="text-sm text-[var(--text-muted)]">You do not have access to this event.</p>
            <Link href="/dashboard/executive-risk" className="mt-2 block text-sm font-semibold text-[var(--primary)] hover:underline">
              ← Back to Revenue Risks
            </Link>
          </CardBody>
        </Card>
      </div>
    );
  }

  const { data: linkedSource } = await supabase
    .from("risk_event_links")
    .select("source_event_id, target_event_id, link_type")
    .or(`source_event_id.eq.${eventId},target_event_id.eq.${eventId}`);
  const linkedIds = new Set<string>();
  for (const l of linkedSource ?? []) {
    const s = (l as { source_event_id: string }).source_event_id;
    const t = (l as { target_event_id: string }).target_event_id;
    if (s !== eventId) linkedIds.add(s);
    if (t !== eventId) linkedIds.add(t);
  }
  const { data: linkedEvents } =
    linkedIds.size > 0
      ? await supabase
          .from("risk_events")
          .select("id, provider, object, timestamp")
          .in("id", [...linkedIds])
          .order("timestamp", { ascending: true })
      : { data: [] };

  let changeApprovals: Array<{ approval_area: string; decision: string; decided_at: string | null }> = [];
  let changeEvidence: Array<{ kind: string; label: string; status?: string }> = [];
  let auditRows: Array<{ action: string; created_at: string }> = [];
  if (row.change_event_id) {
    const [aRes, eRes, audRes] = await Promise.all([
      supabase
        .from("approvals")
        .select("approval_area, decision, decided_at")
        .eq("change_event_id", row.change_event_id),
      supabase
        .from("change_evidence_items")
        .select("kind, label, status")
        .eq("change_event_id", row.change_event_id),
      supabase
        .from("audit_log")
        .select("action, created_at")
        .eq("org_id", row.org_id)
        .or(`change_event_id.eq.${row.change_event_id},and(entity_type.eq.change,entity_id.eq.${row.change_event_id})`)
        .order("created_at", { ascending: false })
        .limit(20),
    ]);
    changeApprovals = (aRes.data ?? []) as typeof changeApprovals;
    changeEvidence = (eRes.data ?? []) as typeof changeEvidence;
    auditRows = (audRes.data ?? []) as typeof auditRows;
  }

  const timelineItems: { label: string; time: string; provider?: string }[] = [
    { label: `${row.provider} ${row.object} updated`, time: row.timestamp, provider: row.provider },
  ];
  for (const le of (linkedEvents ?? []) as Array<{ id: string; provider: string; object: string; timestamp: string }>) {
    if (le.id !== eventId) {
      timelineItems.push({
        label: `${le.provider} ${le.object} updated`,
        time: le.timestamp,
        provider: le.provider,
      });
    }
  }
  timelineItems.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
  timelineItems.push({
    label: "Solvren detected risk",
    time: row.created_at,
    provider: "solvren",
  });
  timelineItems.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
  if (row.approved_at) {
    timelineItems.push({ label: "Approval granted", time: row.approved_at });
  }

  return (
    <div className="space-y-6">
      <Phase3RiskAlertViewedTracker riskEventId={eventId} />
      <PageHeader
        breadcrumbs={[
          { label: "Overview", href: "/dashboard" },
          { label: "Revenue Risks", href: "/dashboard/executive-risk" },
          { label: "Revenue Risk Detected" },
        ]}
        title={`${row.provider.charAt(0).toUpperCase() + row.provider.slice(1)} ${row.object} — ${row.risk_type.replace(/_/g, " ")}`}
        description={row.object_id}
        right={
          row.change_event_id ? (
            <Link
              href={`/changes/${row.change_event_id}`}
              className="text-sm font-semibold text-[var(--primary)] hover:underline"
            >
              View Change →
            </Link>
          ) : null
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
        <Card>
          <CardBody>
            <h2 className="mb-4 font-semibold">Event Details</h2>
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-[var(--text-muted)]">Provider</dt>
                <dd className="font-medium">{row.provider}</dd>
              </div>
              <div>
                <dt className="text-[var(--text-muted)]">Object</dt>
                <dd className="font-medium">{row.object}</dd>
              </div>
              <div>
                <dt className="text-[var(--text-muted)]">Object ID</dt>
                <dd className="font-mono text-xs">{row.object_id}</dd>
              </div>
              <div>
                <dt className="text-[var(--text-muted)]">Field</dt>
                <dd>{row.field ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-[var(--text-muted)]">Old Value</dt>
                <dd className="break-all font-mono text-xs">{formatJson(row.old_value)}</dd>
              </div>
              <div>
                <dt className="text-[var(--text-muted)]">New Value</dt>
                <dd className="break-all font-mono text-xs">{formatJson(row.new_value)}</dd>
              </div>
              <div>
                <dt className="text-[var(--text-muted)]">Risk Score</dt>
                <dd>{row.risk_score}</dd>
              </div>
              <div>
                <dt className="text-[var(--text-muted)]">Risk Level</dt>
                <dd>{riskBadge(row.risk_bucket)}</dd>
              </div>
              <div>
                <dt className="text-[var(--text-muted)]">Impact Amount</dt>
                <dd>{formatMoney(row.impact_amount ?? 0)}</dd>
              </div>
              <div>
                <dt className="text-[var(--text-muted)]">Actor</dt>
                <dd>{row.actor ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-[var(--text-muted)]">Approved At</dt>
                <dd>
                  {row.approved_at
                    ? new Date(row.approved_at).toLocaleString()
                    : "—"}
                </dd>
              </div>
            </dl>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <h2 className="mb-4 font-semibold text-lg">Revenue Risk Timeline</h2>
            <p className="mb-4 text-sm text-[var(--text-muted)]">
              How this change flowed across systems — something no other system can show.
            </p>
            <div className="relative space-y-0">
              {timelineItems.map((item, i) => (
                <div key={i} className="flex gap-4 pb-6 last:pb-0">
                  <div className="relative flex shrink-0 flex-col items-center">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-[var(--primary)] bg-[var(--bg-surface)] text-sm font-semibold text-[var(--primary)]">
                      {i + 1}
                    </div>
                    {i < timelineItems.length - 1 && (
                      <div className="absolute top-10 left-1/2 h-full w-0.5 -translate-x-1/2 bg-[var(--border)]" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1 pt-0.5">
                    <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">
                      {new Date(item.time).toLocaleTimeString("en-US", {
                        hour: "numeric",
                        minute: "2-digit",
                        hour12: true,
                      })}
                    </p>
                    <p className="mt-1 font-medium text-[var(--text)]">{item.label}</p>
                    {item.provider && (
                      <p className="mt-0.5 text-xs text-[var(--text-muted)] capitalize">
                        {item.provider}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
            {row.change_event_id && (
              <Link
                href={`/changes/${row.change_event_id}`}
                className="mt-4 block text-sm font-semibold text-[var(--primary)] hover:underline"
              >
                View linked change →
              </Link>
            )}
          </CardBody>
        </Card>
        </div>

        <div className="space-y-6">
          <RiskExplanationPanel riskEventId={eventId} />
        </div>
      </div>

      {row.change_event_id && (changeApprovals.length > 0 || changeEvidence.length > 0) && (
        <Card>
          <CardBody>
            <h2 className="mb-4 font-semibold">Governance Evidence</h2>
            {changeApprovals.length > 0 && (
              <div className="mb-4">
                <h3 className="text-sm font-medium text-[var(--text-muted)]">Approvals</h3>
                <ul className="mt-1 space-y-1 text-sm">
                  {changeApprovals.map((a, i) => (
                    <li key={i}>
                      {a.approval_area}: {a.decision}
                      {a.decided_at ? ` at ${new Date(a.decided_at).toLocaleString()}` : ""}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {changeEvidence.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-[var(--text-muted)]">Evidence</h3>
                <ul className="mt-1 space-y-1 text-sm">
                  {changeEvidence.map((e, i) => (
                    <li key={i}>
                      {e.label || e.kind}: {(e as { status?: string }).status ?? "—"}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardBody>
        </Card>
      )}

      {auditRows.length > 0 && (
        <Card>
          <CardBody>
            <h2 className="mb-4 font-semibold">Audit Log</h2>
            <ul className="space-y-2 text-sm">
              {auditRows.map((a, i) => (
                <li key={i} className="flex justify-between gap-4">
                  <span>{a.action}</span>
                  <span className="text-[var(--text-muted)]">
                    {new Date(a.created_at).toLocaleString()}
                  </span>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
