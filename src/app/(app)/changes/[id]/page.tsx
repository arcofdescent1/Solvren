import { createServerSupabaseClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { PageHeader, Card, CardBody } from "@/ui";
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

export default async function ChangeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) redirect("/login");

  const { data: change, error: ceErr } = await supabase
    .from("change_events")
    .select("*")
    .eq("id", id)
    .single();

  if (ceErr || !change)
    return (
      <div className="space-y-4">
        <PageHeader
          breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }]}
          title="Change not found"
        />
        <Card>
          <CardBody>
            <p className="text-sm text-[var(--text-muted)]">The requested change could not be found.</p>
            <Link href="/dashboard" className="mt-2 block text-sm font-semibold text-[var(--primary)] hover:underline">
              ← Back to dashboard
            </Link>
          </CardBody>
        </Card>
      </div>
    );

  const allowed = await canViewChange(supabase, userRes.user.id, change);
  if (!allowed) {
    return (
      <div className="space-y-4">
        <PageHeader
          breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }]}
          title="Access denied"
        />
        <Card>
          <CardBody>
            <p className="text-sm text-[var(--text-muted)]">You do not have permission to view this change.</p>
            <Link href="/dashboard" className="mt-2 block text-sm font-semibold text-[var(--primary)] hover:underline">
              ← Back to dashboard
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
        title: issue?.title ?? "—",
        status: issue?.status ?? "—",
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

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Changes", href: "/changes" },
          { label: change.title ?? "Change", href: `/changes/${id}` },
        ]}
        title={change.title ?? "Untitled change"}
        description={
          <span className="text-sm flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${
                change.status === "DRAFT"
                  ? "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200"
                  : change.status === "READY"
                    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200"
                    : change.status === "IN_REVIEW"
                      ? "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200"
                      : change.status === "APPROVED"
                        ? "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200"
                        : change.status === "REJECTED"
                          ? "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200"
                          : "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200"
              }`}
            >
              {change.status === "DRAFT" ? "Draft" : change.status === "READY" ? "Ready" : change.status === "IN_REVIEW" ? "In Review" : change.status === "APPROVED" ? "Approved" : change.status === "REJECTED" ? "Rejected" : (change.status ?? "—")}
            </span>
            {change.change_type && <span>• {change.change_type}</span>}
            {(change as { domain?: string }).domain && (
              <>
                <span className="inline-flex items-center rounded border border-current/30 px-1.5 py-0.5 text-xs font-medium">
                  Domain: {(change as { domain: string }).domain}
                </span>
              </>
            )}
            {(change as { is_restricted?: boolean | null }).is_restricted ? (
              <span className="inline-flex items-center rounded border border-[var(--danger)] px-1.5 py-0.5 text-xs font-semibold text-[var(--danger)]">
                Restricted
              </span>
            ) : null}
          </span>
        }
        right={
          <div className="flex flex-wrap items-center gap-2">
            {(change.status === "DRAFT" || change.status === "READY") && (
              <Link
                href={`/changes/${id}/intake?step=review`}
                className="inline-flex h-10 items-center justify-center rounded-md border border-[var(--border)] bg-transparent px-4 text-sm font-semibold text-[var(--text)] transition-colors hover:bg-[var(--bg-surface-2)]"
              >
                Guided intake
              </Link>
            )}
            <PredictionBadge changeId={id} />
            <LinkIncidentButton
              changeEventId={change.id}
              orgId={change.org_id}
            />
            <SubmitForReviewButton changeEventId={id} status={change.status} />
            <RunSlaTickButton />
            <span className="text-[var(--text-muted)]">|</span>
            <a
              href={`/api/changes/${id}/approval-packet`}
              className="text-sm font-semibold text-[var(--primary)] hover:underline"
              download
            >
              Packet (MD)
            </a>
            <a
              href={`/api/changes/${id}/approval-packet?format=pdf`}
              className="text-sm font-semibold text-[var(--primary)] hover:underline"
              download
            >
              Packet (PDF)
            </a>
          </div>
        }
      />

      <Card>
        <CardBody>
          <SlaBadge
            dueAt={change.due_at ?? null}
            slaStatus={change.sla_status ?? null}
            escalatedAt={change.escalated_at ?? null}
          />
          <ReadyStatusBanner changeId={id} />
          <GovernanceRulesBanner
            orgId={orgId}
            changeType={(change as { change_type?: string }).change_type}
            impactAmount={(change as { estimated_mrr_affected?: number }).estimated_mrr_affected}
            domain={(change as { domain?: string }).domain}
            riskBucket={assessment?.risk_bucket ?? null}
          />
          {change.last_notified_at && (
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              Last notified: {new Date(change.last_notified_at).toLocaleString()}
            </p>
          )}
          {assessment?.risk_bucket && (
            <p className="mt-2 text-xs text-[var(--text-muted)]">
              {requiredEvidence.length === 0
                ? "Evidence: none required"
                : missingEvidenceKinds.length === 0
                  ? `Evidence: ${requiredEvidence.length}/${requiredEvidence.length} complete ✅`
                  : `Evidence: ${requiredEvidence.length - missingEvidenceKinds.length}/${requiredEvidence.length} attached`}
            </p>
          )}
        </CardBody>
      </Card>

      <div id="sla" className="scroll-mt-24">
        <SlaTimeline changeId={id} />
      </div>

      {(requiredEvidence.length > 0 ||
        requiredApprovalAreas.length > 0 ||
        (change as { domain?: string }).domain) && (
        <Card>
          <CardBody>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--text-muted)]">
              Governance
            </h2>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
            <span>
              <strong>Domain:</strong>{" "}
              {(change as { domain?: string }).domain ?? "REVENUE"}
            </span>
            {requiredEvidence.length > 0 && (
              <span>
                <strong>Evidence:</strong>{" "}
                {requiredEvidence.length - missingEvidenceKinds.length}/
                {requiredEvidence.length} complete
                {missingEvidenceKinds.length > 0 &&
                  ` (Missing: ${missingEvidenceKinds.map((k) => EVIDENCE_KIND_LABEL[k as keyof typeof EVIDENCE_KIND_LABEL] ?? k).join(", ")})`}
              </span>
            )}
            {requiredEvidence.length === 0 && bucket && (
              <span>
                <strong>Evidence:</strong> none required
              </span>
            )}
            {requiredApprovalAreas.length > 0 && (
              <span>
                <strong>Approvals:</strong>{" "}
                {requiredApprovalAreas.length - missingApprovalAreas.length}/
                {requiredApprovalAreas.length} assigned
                {missingApprovalAreas.length > 0 &&
                  ` (Missing: ${missingApprovalAreas.join(", ")})`}
              </span>
            )}
          </div>
          </CardBody>
        </Card>
      )}

      <IncidentsPanel changeEventId={change.id} />

      <Card>
        <CardBody>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--text-muted)] mb-2">
            Linked issues
          </h2>
          {linkedIssues.length > 0 ? (
            <ul className="space-y-2">
              {linkedIssues.map((li) => (
                <li key={li.id} className="flex items-center gap-2 text-sm">
                  <span className="inline-flex rounded border border-[var(--border)] px-1.5 py-0.5 text-xs font-medium">
                    {li.link_type}
                  </span>
                  <Link
                    href={`/issues/${li.id}`}
                    className="font-mono text-[var(--primary)] hover:underline"
                  >
                    {li.issue_key}
                  </Link>
                  <span className="text-[var(--text-muted)]">—</span>
                  <span>{li.title}</span>
                  <span className="text-[var(--text-muted)]">({li.status})</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-[var(--text-muted)]">No linked issues.</p>
          )}
          <div className="mt-2">
            <LinkIssueButton changeId={id} />
          </div>
        </CardBody>
      </Card>

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
      <CoordinationAutopilotCard changeId={id} />
      <RevenueImpactReportPanel changeId={id} />
      <ReportSuggestionsPanel changeId={id} />
      <EvidenceChecklist changeId={id} />

      <ChangeAssessmentPanel
        changeEventId={id}
        signals={(signals ?? []) as Parameters<typeof ChangeAssessmentPanel>[0]["signals"]}
        assessment={assessment}
      />

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
          <CardBody>
            <h2 className="font-semibold">Checklist (generated)</h2>
            <pre className="mt-2 text-sm whitespace-pre-wrap text-[var(--text)]">{assessment.report_md}</pre>
          </CardBody>
        </Card>
      )}

      {(requiredApprovalAreas.length > 0 || (approvals && approvals.length > 0)) && (
        <div id="approvals" className="scroll-mt-24">
          <ApprovalsPanel
          approvals={(approvals ?? []) as Parameters<typeof ApprovalsPanel>[0]["approvals"]}
          currentUserId={currentUserId}
          requiredApprovalAreas={requiredApprovalAreas}
        />
        </div>
      )}

      <DeliveryPanel deliveries={deliveries ?? []} />

      <ChangeTimeline changeId={id} />

      <RestrictedAccessPanel
        changeId={id}
        isRestricted={Boolean((change as { is_restricted?: boolean | null }).is_restricted)}
      />

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
        <CardBody>
          <h2 className="font-semibold">Deterministic signals</h2>
          <div className="mt-2 space-y-2">
            {deterministicSignals.map((s) => (
              <div key={s.id} className="rounded-[var(--radius-sb)] border border-[var(--border)] p-2 text-sm">
              <div className="flex justify-between gap-3">
                <span className="font-mono">{s.signal_key}</span>
                <span className="opacity-70 text-xs">
                  +{s.contribution ?? 0} (w={s.weight_at_time ?? 0}) • {s.source}
                </span>
              </div>
              <div className="opacity-80">
                value:{" "}
                {s.value_type === "BOOLEAN"
                  ? String(s.value_bool)
                  : String(s.value_num)}
                {" • "}
                {s.category}
              </div>
            </div>
          ))}
          {deterministicSignals.length === 0 && (
            <p className="text-sm text-[var(--text-muted)]">No deterministic signals yet.</p>
          )}
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
