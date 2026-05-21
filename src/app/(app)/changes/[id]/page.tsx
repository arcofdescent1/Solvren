import { scopeActiveChangeEvents } from "@/lib/db/changeEventScope";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardDescription,
  CardHeader,
  CardTitle,
  PageHeaderV2,
  SectionHeader,
} from "@/ui";
import ChangeAssessmentPanel from "@/components/ChangeAssessmentPanel";
import { RevenueExposureCard } from "@/components/changes/RevenueExposureCard";
import { MitigationsPanel } from "@/components/changes/MitigationsPanel";
import RevenueImpactReportPanel from "@/components/changes/RevenueImpactReportPanel";
import ReportSuggestionsPanel from "@/components/changes/ReportSuggestionsPanel";
import { CoordinationAutopilotCard } from "@/components/coordination/CoordinationAutopilotCard";
import EvidenceChecklist from "@/components/changes/EvidenceChecklist";
import ApprovalsPanel from "@/components/ApprovalsPanel";
import EvidencePanel from "@/components/EvidencePanel";
import DeliveryPanel from "@/components/DeliveryPanel";
import { SignalCorrelationPanel } from "@/components/risk/SignalCorrelationPanel";
import { RiskBreakdownCard } from "@/components/changes/RiskBreakdownCard";
import AuditPanel, { type AuditRow } from "@/components/AuditPanel";
import ChangeTimeline from "@/components/changes/ChangeTimeline";
import SlaBadge from "@/components/SlaBadge";
import PredictionBadge from "@/components/changes/PredictionBadge";
import { SlaTimeline } from "@/components/SlaTimeline";
import ReadyStatusBanner from "@/components/ReadyStatusBanner";
import { GovernanceRulesBanner } from "@/components/changes/GovernanceRulesBanner";
import SubmitForReviewButton from "@/components/SubmitForReviewButton";
import RunSlaTickButton from "@/components/RunSlaTickButton";
import LinkIncidentButton from "@/components/incidents/LinkIncidentButton";
import IncidentsPanel from "@/components/incidents/IncidentsPanel";
import { LinkIssueButton } from "@/components/changes/LinkIssueButton";
import { getRequiredEvidenceAndApprovalAreas } from "@/services/domains/approvalRequirements";
import { getGovernanceTemplate } from "@/services/risk/governance";
import { EVIDENCE_KIND_LABEL } from "@/services/risk/requirements";
import { isRiskDomain, type RiskDomain } from "@/types/risk";
import type { EvidenceKind, RiskBucket } from "@/services/risk/requirements";
import { canViewChange } from "@/lib/access/changeAccess";
import RestrictedAccessPanel from "@/components/changes/RestrictedAccessPanel";

function formatMoney(value: number | null | undefined) {
  if (value == null || !Number.isFinite(Number(value))) return "Not estimated";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(Number(value));
}

function statusLabel(status: string | null | undefined) {
  if (status === "DRAFT") return "Draft";
  if (status === "READY") return "Ready";
  if (status === "IN_REVIEW") return "In review";
  if (status === "APPROVED") return "Approved";
  if (status === "REJECTED") return "Rejected";
  if (status === "CLOSED") return "Closed";
  if (status === "RESOLVED") return "Resolved";
  return status ?? "Unknown";
}

function statusTone(status: string | null | undefined): "secondary" | "success" | "warning" | "danger" | "outline" {
  if (status === "APPROVED" || status === "RESOLVED") return "success";
  if (status === "IN_REVIEW" || status === "READY") return "warning";
  if (status === "REJECTED") return "danger";
  if (status === "DRAFT") return "secondary";
  return "outline";
}

export default async function ChangeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) redirect("/login");

  const { data: change, error: ceErr } = await scopeActiveChangeEvents(supabase.from("change_events").select("*"))
    .eq("id", id)
    .single();

  if (ceErr || !change)
    return (
      <div className="space-y-4">
        <PageHeaderV2
          breadcrumbs={[{ label: "Home", href: "/home" }, { label: "Changes", href: "/changes" }]}
          title="Change not found"
        />
        <Card>
          <CardBody>
            <p className="text-sm text-[var(--text-muted)]">The requested change could not be found.</p>
            <Link href="/changes" className="mt-2 block text-sm font-semibold text-[var(--primary)] hover:underline">
              Back to changes
            </Link>
          </CardBody>
        </Card>
      </div>
    );

  const allowed = await canViewChange(supabase, userRes.user.id, change);
  if (!allowed) {
    return (
      <div className="space-y-4">
        <PageHeaderV2
          breadcrumbs={[{ label: "Home", href: "/home" }, { label: "Changes", href: "/changes" }]}
          title="Access denied"
        />
        <Card>
          <CardBody>
            <p className="text-sm text-[var(--text-muted)]">You do not have permission to view this change.</p>
            <Link href="/changes" className="mt-2 block text-sm font-semibold text-[var(--primary)] hover:underline">
              Back to changes
            </Link>
          </CardBody>
        </Card>
      </div>
    );
  }

  const { data: signals } = await supabase
    .from("risk_signals")
    .select("id, signal_key, value_type, value_bool, value_num, source, category, weight_at_time, contribution, created_at")
    .eq("change_event_id", id)
    .order("contribution", { ascending: false })
    .order("created_at", { ascending: true });

  const { data: assessment } = await supabase
    .from("impact_assessments")
    .select("id, status, risk_score_raw, risk_bucket, report_md, missing_evidence_suggestions, pass_a_output, created_at")
    .eq("change_event_id", id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: approvals } = await supabase
    .from("approvals")
    .select("id, approval_area, decision, comment, decided_at, approver_user_id, created_at")
    .eq("change_event_id", id)
    .order("created_at", { ascending: true });

  const { data: evidence } = await supabase
    .from("change_evidence")
    .select("id, kind, label, url, note, created_at")
    .eq("change_event_id", id)
    .order("created_at", { ascending: false });

  const { data: deliveries } = await supabase
    .from("notification_outbox")
    .select(
      "id, channel, template_key, status, attempt_count, last_error, created_at, sent_at, delivered_count"
    )
    .eq("change_event_id", id)
    .order("created_at", { ascending: false })
    .limit(30);

  const { data: auditRows } = await supabase
    .from("audit_log")
    .select(
      "id, change_event_id, actor_id, actor_type, action, entity_type, entity_id, metadata, created_at"
    )
    .eq("org_id", change.org_id)
    .or(`change_event_id.eq.${id},and(entity_type.eq.change,entity_id.eq.${id})`)
    .order("created_at", { ascending: false })
    .limit(200);

  const { data: changeIssueLinks } = await supabase
    .from("change_issue_links")
    .select("id, issue_id, link_type")
    .eq("change_id", id);
  const linkedIssueIds = (changeIssueLinks ?? []).map((l: { issue_id: string }) => l.issue_id);
  type IssueRow = { id: string; issue_key: string; title: string; status: string };
  let linkedIssues: Array<{ id: string; issue_key: string; title: string; status: string; link_type: string }> = [];
  if (linkedIssueIds.length > 0) {
    const { data: issuesRows } = await supabase
      .from("issues")
      .select("id, issue_key, title, status")
      .in("id", linkedIssueIds);
    const issueMap = new Map<string, IssueRow>(
      (issuesRows ?? []).map((r: IssueRow) => [r.id, r])
    );
    linkedIssues = (changeIssueLinks ?? []).map((l: { issue_id: string; link_type: string }) => {
      const issue = issueMap.get(l.issue_id);
      return {
        id: l.issue_id,
        issue_key: issue?.issue_key ?? l.issue_id.slice(0, 8),
        title: issue?.title ?? "-",
        status: issue?.status ?? "-",
        link_type: l.link_type,
      };
    });
  }

  const currentUserId = userRes.user.id;

  const domain = (isRiskDomain(String((change as { domain?: string }).domain))
    ? ((change as { domain: string }).domain as RiskDomain)
    : "REVENUE") as RiskDomain;
  const bucket = (assessment?.risk_bucket ?? null) as RiskBucket | null;
  const domainKey = String(domain);
  const orgId = change.org_id as string;

  let requiredEvidence: string[] = [];
  let requiredApprovalAreas: string[] = [];
  try {
    const domainReqs = await getRequiredEvidenceAndApprovalAreas(supabase, {
      orgId,
      domainKey,
    });
    if (
      domainReqs.requiredApprovalAreas.length > 0 ||
      domainReqs.requiredEvidenceKinds.length > 0
    ) {
      requiredEvidence = domainReqs.requiredEvidenceKinds;
      requiredApprovalAreas = domainReqs.requiredApprovalAreas;
    }
  } catch {
    // Fall through to governance template
  }
  if (
    requiredEvidence.length === 0 &&
    requiredApprovalAreas.length === 0 &&
    bucket != null
  ) {
    const governanceTpl = await getGovernanceTemplate(supabase, domain, bucket);
    requiredEvidence = governanceTpl?.required_evidence_kinds ?? [];
    requiredApprovalAreas = governanceTpl?.required_approval_areas ?? [];
  }
  const presentEvidenceKinds = new Set((evidence ?? []).map((e: { kind: string }) => e.kind));
  const missingEvidenceKinds = requiredEvidence.filter(
    (k: string) => !presentEvidenceKinds.has(k)
  );
  const presentApprovalAreas = new Set(
    (approvals ?? []).map((a: { approval_area: string }) => a.approval_area)
  );
  const missingApprovalAreas = requiredApprovalAreas.filter(
    (a: string) => !presentApprovalAreas.has(a)
  );

  const deterministicSignals = (signals ?? []).filter(
    (s: { source?: string }) => s.source === "RULE"
  );
  const pendingApprovalCount = (approvals ?? []).filter((a: { decision: string }) => a.decision === "PENDING").length;
  const approvedCount = (approvals ?? []).filter((a: { decision: string }) => a.decision === "APPROVED").length;
  const totalApprovalCount = approvals?.length ?? 0;
  const approvalTargetCount = Math.max(totalApprovalCount, requiredApprovalAreas.length);
  const revenueAtRisk = (change as { revenue_at_risk?: number | null }).revenue_at_risk ?? null;
  const estimatedMrr = (change as { estimated_mrr_affected?: number | null }).estimated_mrr_affected ?? null;
  const isOwner = change.created_by === currentUserId;
  const myPendingApproval = (approvals ?? []).some(
    (a: { approver_user_id: string; decision: string }) => a.approver_user_id === currentUserId && a.decision === "PENDING"
  );
  const primaryNextStep = myPendingApproval
    ? "Review evidence and decide"
    : change.status === "DRAFT" || change.status === "READY"
      ? isOwner
        ? "Finish intake and submit"
        : "Waiting for submitter"
      : pendingApprovalCount > 0
        ? "Waiting on approvals"
        : missingEvidenceKinds.length > 0
          ? "Add required evidence"
          : change.status === "APPROVED"
            ? "Monitor release and outcomes"
            : "Review current status";
  const executiveDecision = change.status === "APPROVED"
    ? "Approved. Monitor the release and confirm outcomes."
    : change.status === "REJECTED"
      ? "Not approved. Review the concerns before moving forward."
      : pendingApprovalCount > 0
        ? "Needs executive or functional approval before shipping."
        : missingEvidenceKinds.length > 0
          ? "Not ready yet. Required proof is missing."
          : "Ready for review. No required evidence is currently missing.";
  const protectionStatus = missingEvidenceKinds.length > 0
    ? `${missingEvidenceKinds.length} proof item${missingEvidenceKinds.length === 1 ? "" : "s"} needed`
    : "Proof is complete";
  const approvalStatus = approvalTargetCount === 0
    ? "No approval lanes required"
    : `${approvedCount} of ${approvalTargetCount} approvals complete`;
  const customerImpact = (change as { percent_customer_base_affected?: number | null }).percent_customer_base_affected;
  const visibleRevenueSurface = (change as { revenue_surface?: string | null }).revenue_surface ?? (change as { domain?: string }).domain ?? "Revenue systems";

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeaderV2
        breadcrumbs={[
          { label: "Home", href: "/home" },
          { label: "Changes", href: "/changes" },
          { label: change.title ?? "Change" },
        ]}
        title={change.title ?? "Untitled change"}
        description="A plain-English decision record for a revenue-sensitive change."
      />

      <Card className="sticky top-[calc(var(--topbar-height)+0.75rem)] z-20 border-[var(--primary)]/20 bg-[color:color-mix(in_oklab,var(--bg-surface)_96%,var(--bg-app))] shadow-md">
        <CardBody className="py-3">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <nav className="flex flex-wrap gap-1 text-sm" aria-label="Change decision sections">
              {[
                { label: "Decision", href: "#decision" },
                { label: "Revenue impact", href: "#impact" },
                { label: "Proof", href: "#proof" },
                { label: "Approvals", href: "#approvals" },
                { label: "Activity", href: "#activity" },
                { label: "System record", href: "#system-details" },
              ].map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  className="inline-flex h-9 items-center rounded-[var(--radius-md)] px-3 font-semibold text-[var(--text-muted)] transition hover:bg-[var(--bg-surface-2)] hover:text-[var(--primary)]"
                >
                  {item.label}
                </a>
              ))}
            </nav>
            <div className="flex flex-wrap items-center gap-2">
              {(change.status === "DRAFT" || change.status === "READY") && (
                <Button asChild variant="secondary" size="md">
                  <Link href={`/changes/${id}/intake?step=review`}>Guided intake</Link>
                </Button>
              )}
              <LinkIncidentButton changeEventId={change.id} orgId={change.org_id} />
              <SubmitForReviewButton changeEventId={id} status={change.status} />
              <Button asChild variant="outline" size="md">
                <a href={`/api/changes/${id}/approval-packet?format=pdf`} download>
                  Proof packet
                </a>
              </Button>
            </div>
          </div>
        </CardBody>
      </Card>

      <section id="decision" className="scroll-mt-28 space-y-4">
        <Card className="border-[var(--primary)]/25">
          <CardBody className="p-0">
            <div className="grid gap-0 lg:grid-cols-[minmax(0,1.4fr)_minmax(340px,0.8fr)]">
              <div className="space-y-5 p-6">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={statusTone(change.status)}>{statusLabel(change.status)}</Badge>
                  {assessment?.risk_bucket ? <Badge variant="outline">{assessment.risk_bucket} attention</Badge> : null}
                  {(change as { is_restricted?: boolean | null }).is_restricted ? <Badge variant="danger">Restricted</Badge> : null}
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-[var(--primary)]">Executive decision brief</p>
                  <h2 className="mt-2 text-2xl font-semibold tracking-normal text-[var(--text)]">{executiveDecision}</h2>
                  <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--text-muted)]">
                    This page summarizes the business risk, proof, ownership, and next action so leaders can decide quickly without reading implementation details.
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--bg-surface-2)] p-4">
                    <p className="text-xs font-medium text-[var(--text-muted)]">Money at risk</p>
                    <p className="mt-2 text-2xl font-semibold">{formatMoney(revenueAtRisk ?? estimatedMrr)}</p>
                  </div>
                  <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--bg-surface-2)] p-4">
                    <p className="text-xs font-medium text-[var(--text-muted)]">Approval progress</p>
                    <p className="mt-2 text-lg font-semibold">{approvalStatus}</p>
                  </div>
                  <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--bg-surface-2)] p-4">
                    <p className="text-xs font-medium text-[var(--text-muted)]">Proof status</p>
                    <p className="mt-2 text-lg font-semibold">{protectionStatus}</p>
                  </div>
                </div>
              </div>

              <aside className="border-t border-[var(--border)] bg-[var(--card-cap-bg)] p-6 lg:border-l lg:border-t-0">
                <h3 className="text-base font-semibold">What needs to happen next</h3>
                <p className="mt-2 text-sm text-[var(--text-muted)]">{primaryNextStep}</p>
                <div className="mt-5 space-y-3 text-sm">
                  <div className="flex items-start justify-between gap-4 border-b border-[var(--border)] pb-3">
                    <span className="text-[var(--text-muted)]">Revenue area</span>
                    <span className="text-right font-semibold">{visibleRevenueSurface}</span>
                  </div>
                  <div className="flex items-start justify-between gap-4 border-b border-[var(--border)] pb-3">
                    <span className="text-[var(--text-muted)]">Customers affected</span>
                    <span className="text-right font-semibold">{customerImpact == null ? "Not estimated" : `${customerImpact}%`}</span>
                  </div>
                  <div className="flex items-start justify-between gap-4 border-b border-[var(--border)] pb-3">
                    <span className="text-[var(--text-muted)]">Open reviews</span>
                    <span className="text-right font-semibold">{pendingApprovalCount}</span>
                  </div>
                </div>
                <div className="mt-5 flex flex-wrap gap-2">
                  <PredictionBadge changeId={id} />
                  <RunSlaTickButton />
                </div>
              </aside>
            </div>
          </CardBody>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.45fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Can this safely move forward?</CardTitle>
            <CardDescription>Solvren checks that the right proof and decisions are in place before the change ships.</CardDescription>
          </CardHeader>
          <CardBody className="space-y-4">
            <SlaBadge dueAt={change.due_at ?? null} slaStatus={change.sla_status ?? null} escalatedAt={change.escalated_at ?? null} />
            <ReadyStatusBanner changeId={id} />
            <GovernanceRulesBanner
              orgId={orgId}
              changeType={(change as { change_type?: string }).change_type}
              impactAmount={(change as { estimated_mrr_affected?: number }).estimated_mrr_affected}
              domain={(change as { domain?: string }).domain}
              riskBucket={assessment?.risk_bucket ?? null}
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Board-ready packet</CardTitle>
            <CardDescription>A shareable record of the decision, risk, proof, approvals, and delivery history.</CardDescription>
          </CardHeader>
          <CardBody className="space-y-3">
            <Button asChild className="w-full">
              <a href={`/api/changes/${id}/approval-packet?format=pdf`} download>Download PDF</a>
            </Button>
            <Button asChild variant="secondary" className="w-full">
              <a href={`/api/changes/${id}/approval-packet?format=md`} download>Download Markdown</a>
            </Button>
            <p className="text-xs leading-5 text-[var(--text-muted)]">
              Use this outside Solvren for leadership review, board prep, or change-approval evidence.
            </p>
          </CardBody>
        </Card>
      </section>

      <section id="impact" className="scroll-mt-28 space-y-3">
        <SectionHeader title="Revenue impact" helper="The business context a leader needs before approving or escalating." />
        <RevenueExposureCard
          changeId={id}
          initial={{
            estimatedMrrAffected: (change as { estimated_mrr_affected?: number | null }).estimated_mrr_affected ?? null,
            percentCustomerBaseAffected: (change as { percent_customer_base_affected?: number | null }).percent_customer_base_affected ?? null,
            revenueSurface: (change as { revenue_surface?: string | null }).revenue_surface ?? null,
            revenue: {
              revenueAtRisk: (change as { revenue_at_risk?: number | null }).revenue_at_risk ?? undefined,
              exposureMultiplier: (change as { revenue_exposure_multiplier?: number | null }).revenue_exposure_multiplier ?? undefined,
              explanation: (change as { revenue_exposure_explanation?: Record<string, unknown> | null }).revenue_exposure_explanation ?? undefined,
            },
          }}
        />
        <MitigationsPanel changeId={id} />
        <RevenueImpactReportPanel changeId={id} />
        <ReportSuggestionsPanel changeId={id} />
        <ChangeAssessmentPanel
          changeEventId={id}
          signals={(signals ?? []) as Parameters<typeof ChangeAssessmentPanel>[0]["signals"]}
          assessment={assessment}
        />
      </section>

      <section id="proof" className="scroll-mt-28 space-y-3">
        <SectionHeader title="Proof before approval" helper="The evidence and coordination plan reviewers need to make a confident decision." />
        <CoordinationAutopilotCard changeId={id} />
        <EvidenceChecklist changeId={id} />
        <EvidencePanel
          changeEventId={id}
          orgId={change.org_id}
          riskBucket={(assessment?.risk_bucket ?? null) as Parameters<typeof EvidencePanel>[0]["riskBucket"]}
          requiredEvidenceKinds={requiredEvidence as EvidenceKind[]}
          requiredEvidenceKindsOverride={undefined}
          evidence={(evidence ?? []) as Parameters<typeof EvidencePanel>[0]["evidence"]}
          missingEvidenceSuggestions={assessment?.missing_evidence_suggestions as Parameters<typeof EvidencePanel>[0]["missingEvidenceSuggestions"]}
        />
        {assessment?.report_md && (
          <Card id="checklist">
            <CardHeader>
              <CardTitle>Generated reviewer checklist</CardTitle>
              <CardDescription>Additional review notes created from the current assessment.</CardDescription>
            </CardHeader>
            <CardBody>
              <pre className="whitespace-pre-wrap text-sm text-[var(--text)]">{assessment.report_md}</pre>
            </CardBody>
          </Card>
        )}
      </section>

      <section id="approvals" className="scroll-mt-28 space-y-3">
        <SectionHeader title="People who need to decide" helper="Approvers, missing decision lanes, and who still needs to act." />
        {(requiredApprovalAreas.length > 0 || (approvals && approvals.length > 0)) ? (
          <ApprovalsPanel
            approvals={(approvals ?? []) as Parameters<typeof ApprovalsPanel>[0]["approvals"]}
            currentUserId={currentUserId}
            requiredApprovalAreas={requiredApprovalAreas}
          />
        ) : (
          <Card>
            <CardBody>
              <p className="text-sm text-[var(--text-muted)]">No approvals are required or assigned yet for this change.</p>
            </CardBody>
          </Card>
        )}
      </section>

      <section id="activity" className="scroll-mt-28 space-y-4">
        <SectionHeader title="Activity and related risks" helper="Incidents, linked issues, and the history of this change." />
        <div className="grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(360px,0.6fr)]">
          <div className="space-y-4">
            <IncidentsPanel changeEventId={change.id} />
            <Card>
              <CardHeader>
                <CardTitle>Linked issues</CardTitle>
                <CardDescription>Connected follow-up work that may affect this decision.</CardDescription>
              </CardHeader>
              <CardBody>
                {linkedIssues.length > 0 ? (
                  <ul className="space-y-2">
                    {linkedIssues.map((li) => (
                      <li key={li.id} className="flex flex-wrap items-center gap-2 text-sm">
                        <Badge variant="outline">{li.link_type}</Badge>
                        <Link href={`/issues/${li.id}`} className="font-mono text-[var(--primary)] hover:underline">
                          {li.issue_key}
                        </Link>
                        <span>{li.title}</span>
                        <span className="text-[var(--text-muted)]">({li.status})</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-[var(--text-muted)]">No linked issues.</p>
                )}
                <div className="mt-3">
                  <LinkIssueButton changeId={id} />
                </div>
              </CardBody>
            </Card>
          </div>
          <div id="timeline" className="scroll-mt-28">
            <ChangeTimeline changeId={id} />
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <SectionHeader title="Operational record" helper="Detailed controls remain available for operators and auditors." />
        <div id="sla" className="scroll-mt-28">
          <SlaTimeline changeId={id} />
        </div>
        {(requiredEvidence.length > 0 || requiredApprovalAreas.length > 0 || (change as { domain?: string }).domain) && (
          <Card>
            <CardHeader>
              <CardTitle>Review rules</CardTitle>
              <CardDescription>The configured proof and approval requirements for this change.</CardDescription>
            </CardHeader>
            <CardBody>
              <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
                <span><strong>Revenue area:</strong> {(change as { domain?: string }).domain ?? "Revenue"}</span>
                <span>
                  <strong>Proof:</strong>{" "}
                  {requiredEvidence.length === 0
                    ? "None required"
                    : `${requiredEvidence.length - missingEvidenceKinds.length}/${requiredEvidence.length} complete`}
                </span>
                <span>
                  <strong>Approvals:</strong>{" "}
                  {requiredApprovalAreas.length === 0
                    ? "None required"
                    : `${requiredApprovalAreas.length - missingApprovalAreas.length}/${requiredApprovalAreas.length} assigned`}
                </span>
              </div>
              {missingEvidenceKinds.length > 0 ? (
                <p className="mt-2 text-sm text-[var(--text-muted)]">
                  Missing proof: {missingEvidenceKinds.map((k) => EVIDENCE_KIND_LABEL[k as keyof typeof EVIDENCE_KIND_LABEL] ?? k).join(", ")}
                </p>
              ) : null}
              {missingApprovalAreas.length > 0 ? (
                <p className="mt-1 text-sm text-[var(--text-muted)]">Missing approvers: {missingApprovalAreas.join(", ")}</p>
              ) : null}
            </CardBody>
          </Card>
        )}
        <RestrictedAccessPanel
          changeId={id}
          isRestricted={Boolean((change as { is_restricted?: boolean | null }).is_restricted)}
        />
      </section>

      <details id="system-details" className="scroll-mt-28 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--bg-surface)] shadow-sm">
        <summary className="cursor-pointer px-[var(--card-spacer-x)] py-[var(--card-spacer-y)] font-semibold">
          System record and audit details
          <span className="ml-2 text-sm font-normal text-[var(--text-muted)]">
            Delivery logs, audit trail, source signals, and scoring details.
          </span>
        </summary>
        <div className="space-y-6 border-t border-[var(--border)] p-[var(--card-spacer-x)]">
          <DeliveryPanel deliveries={deliveries ?? []} />
          <AuditPanel changeId={id} initialRows={(auditRows ?? undefined) as AuditRow[] | undefined} />
          <SignalCorrelationPanel />

          {((change as { risk_explanation?: unknown }).risk_explanation != null ||
            (change as { base_risk_score?: number | null }).base_risk_score != null ||
            (change as { exposure_multiplier?: number | null }).exposure_multiplier != null) && (
            <RiskBreakdownCard
              riskExplanation={(change as { risk_explanation?: unknown }).risk_explanation}
              baseRiskScore={(change as { base_risk_score?: number | null }).base_risk_score}
              exposureMultiplier={(change as { exposure_multiplier?: number | null }).exposure_multiplier}
              revenueRiskScore={(change as { revenue_risk_score?: number | null }).revenue_risk_score}
              exposureComponents={(change as { exposure_components?: Record<string, unknown> | null }).exposure_components}
            />
          )}

          <Card>
            <CardHeader>
              <CardTitle>Source signals</CardTitle>
              <CardDescription>Low-level inputs used by the Solvren assessment engine.</CardDescription>
            </CardHeader>
            <CardBody>
              <div className="space-y-2">
                {deterministicSignals.map((s) => (
                  <div key={s.id} className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-surface-2)] p-3 text-sm">
                    <div className="flex justify-between gap-3">
                      <span className="font-mono">{s.signal_key}</span>
                      <span className="text-xs text-[var(--text-muted)]">+{s.contribution ?? 0} (w={s.weight_at_time ?? 0})</span>
                    </div>
                    <div className="mt-1 text-[var(--text-muted)]">
                      value: {s.value_type === "BOOLEAN" ? String(s.value_bool) : String(s.value_num)} | {s.category} | {s.source}
                    </div>
                  </div>
                ))}
                {deterministicSignals.length === 0 && (
                  <p className="text-sm text-[var(--text-muted)]">No source signals yet.</p>
                )}
              </div>
            </CardBody>
          </Card>
        </div>
      </details>
    </div>
  );
}
