import { scopeActiveChangeEvents } from "@/lib/db/changeEventScope";
import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getIssueDetail } from "@/modules/issues";
import { getLatestAssessmentForIssue } from "@/modules/impact/persistence/impact-assessments.repository";
import { getAccountsByOrg } from "@/modules/integrations/core/integrationAccountsRepo";
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardDescription,
  CardHeader,
  CardTitle,
  DecisionProblemBrief,
  PageActionBar,
  PageHeaderV2,
  SectionHeader,
} from "@/ui";
import {
  IssueDetailNextAction,
  IssueSourcePanel,
  IssueLinksPanel,
  IssueEvidencePanel,
  IssueLineagePanel,
  IssueTimelinePanel,
  IssueVerificationPanel,
  IssueCommentsPanel,
  IssueOwnerPanel,
  IssueActionsPanel,
  IssueOutcomePanel,
  IssueLifecyclePanel,
} from "@/components/issues";
import { IssueImpactSection } from "@/components/impact";
import { Phase3IssueReviewedTracker } from "@/components/onboarding/phase3/Phase3IssueReviewedTracker";

function formatMoney(value: number | null | undefined, currency = "USD") {
  if (value == null || !Number.isFinite(Number(value))) return "Not estimated";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(Number(value));
}

function issueStatusLabel(status: string | null | undefined) {
  if (status === "in_progress") return "In progress";
  if (status === "open") return "Open";
  if (status === "triaged") return "Triaged";
  if (status === "detected") return "Detected";
  if (status === "acknowledged") return "Acknowledged";
  if (status === "assigned") return "Assigned";
  if (status === "resolved") return "Resolved";
  if (status === "verified") return "Verified";
  if (status === "dismissed") return "Dismissed";
  if (status === "reopened") return "Reopened";
  return status ?? "Unknown";
}

function badgeTone(status: string | null | undefined): "secondary" | "success" | "warning" | "danger" | "outline" {
  if (status === "resolved" || status === "verified") return "success";
  if (status === "dismissed") return "secondary";
  if (status === "in_progress" || status === "assigned" || status === "triaged") return "warning";
  if (status === "reopened") return "danger";
  return "outline";
}

function severityTone(severity: string | null | undefined): "secondary" | "success" | "warning" | "danger" | "outline" {
  if (severity === "critical" || severity === "high") return "danger";
  if (severity === "medium") return "warning";
  if (severity === "low") return "secondary";
  return "outline";
}

function nextStepForIssue(status: string, ownerUserId: string | null, ownerTeamKey: string | null) {
  if (!ownerUserId && !ownerTeamKey && status !== "dismissed") return "Assign an owner.";
  if (status === "open" || status === "detected") return "Confirm the problem and assign an owner.";
  if (status === "triaged" || status === "acknowledged") return "Decide the action plan and start work.";
  if (status === "assigned") return "Owner should start work and record the plan.";
  if (status === "in_progress") return "Finish the fix and verify the outcome.";
  if (status === "resolved") return "Verify that revenue risk has actually been removed.";
  if (status === "verified") return "Capture the outcome and proof for leadership.";
  if (status === "dismissed") return "No action is planned unless new evidence appears.";
  if (status === "reopened") return "Reassign ownership and treat this as active again.";
  return "Review the current status and choose the next action.";
}

export default async function IssueDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: issueId } = await params;
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

  const result = await getIssueDetail(supabase, issueId);
  if (result.error || !result.issue) notFound();
  const issue = result.issue;
  if (issue.org_id !== membership.org_id) notFound();

  const { data: accounts } = await getAccountsByOrg(supabase, membership.org_id);
  const connectedProviders = (accounts ?? [])
    .filter((a) => a.provider && (a.status === "connected" || a.status === "degraded"))
    .map((a) => a.provider);

  const [
    { data: sourceRow },
    { data: historyRows },
    { data: verificationRows },
    { data: commentRows },
    { data: linkRows },
    { data: entityRows },
    { data: evidenceRows },
    { data: lineageRows },
    { data: impactSummaryRow },
    { data: legacyImpactRow },
    { data: assessmentRow },
  ] = await Promise.all([
    supabase.from("issue_sources").select("evidence_json").eq("issue_id", issueId).limit(1).maybeSingle(),
    supabase.from("issue_history").select("id, event_type, event_actor_ref, created_at, new_state_json").eq("issue_id", issueId).order("created_at", { ascending: false }).limit(50),
    supabase.from("verification_runs").select("id, verification_type, status, started_at, completed_at, result_summary").eq("issue_id", issueId).order("started_at", { ascending: false }).limit(20),
    supabase.from("issue_comments").select("id, body, author_user_id, created_at").eq("issue_id", issueId).order("created_at", { ascending: false }).limit(50),
    supabase.from("change_issue_links").select("change_id, link_type").eq("issue_id", issueId),
    supabase.from("issue_entities").select("entity_type, external_system, external_id, entity_display_name, canonical_entity_id, role, confidence").eq("issue_id", issueId).limit(20),
    supabase.from("issue_evidence").select("evidence_type, evidence_key, payload_json, confidence").eq("issue_id", issueId).order("created_at", { ascending: true }),
    supabase.from("issue_lineage").select("source_type, source_ref, metadata_json").eq("issue_id", issueId).order("created_at", { ascending: true }),
    supabase.from("issue_impact_summaries").select("*").eq("issue_id", issueId).maybeSingle(),
    supabase.from("issue_impact_assessments").select("revenue_at_risk, customer_count_affected, operational_cost_estimate, confidence_score, model_key").eq("issue_id", issueId).order("calculated_at", { ascending: false }).limit(1).maybeSingle(),
    getLatestAssessmentForIssue(supabase, issue.org_id, issueId).then((r) => ({ data: r.data })),
  ]);

  const evidenceJson = sourceRow?.evidence_json != null ? (sourceRow.evidence_json as Record<string, unknown>) : null;
  const history = (historyRows ?? []).map((h: { id: string; event_type: string; event_actor_ref: string | null; created_at: string; new_state_json?: Record<string, unknown> }) => ({
    id: h.id,
    event_type: h.event_type,
    event_actor_ref: h.event_actor_ref,
    created_at: h.created_at,
    new_state_json: h.new_state_json,
  }));
  const runs = (verificationRows ?? []).map((r: { id: string; verification_type: string; status: string; started_at: string; completed_at: string | null; result_summary: string | null }) => ({
    id: r.id,
    verification_type: r.verification_type,
    status: r.status,
    started_at: r.started_at,
    completed_at: r.completed_at,
    result_summary: r.result_summary,
  }));
  const comments = (commentRows ?? []).map((c: { id: string; body: string; author_user_id: string; created_at: string }) => ({
    id: c.id,
    body: c.body,
    author_user_id: c.author_user_id,
    created_at: c.created_at,
  }));

  const changeIds = (linkRows ?? []).map((l: { change_id: string }) => l.change_id);
  let changeTitles: Map<string, string> = new Map();
  if (changeIds.length > 0) {
    const { data: changeData } = await scopeActiveChangeEvents(supabase.from("change_events").select("id, title")).in("id", changeIds);
    changeTitles = new Map((changeData ?? []).map((c: { id: string; title: string | null }) => [c.id, c.title ?? ""]));
  }
  const changes = (linkRows ?? []).map((l: { change_id: string; link_type: string }) => ({
    changeId: l.change_id,
    linkType: l.link_type,
    title: changeTitles.get(l.change_id),
  }));
  const entities = (entityRows ?? []).map((e: { entity_type: string; external_system: string | null; external_id: string | null; entity_display_name: string | null; canonical_entity_id: string | null; role: string | null; confidence: number }) => ({
    entityType: e.entity_type,
    externalSystem: e.external_system,
    externalId: e.external_id,
    displayName: e.entity_display_name,
    entityId: e.canonical_entity_id,
    role: e.role,
    confidence: e.confidence,
  }));

  const evidence = (evidenceRows ?? []).map((e: { evidence_type: string; evidence_key: string; payload_json: Record<string, unknown>; confidence: number | null }) => ({
    evidenceType: e.evidence_type,
    evidenceKey: e.evidence_key,
    payload: e.payload_json,
    confidence: e.confidence,
  }));

  const lineage = (lineageRows ?? []).map((l: { source_type: string; source_ref: string; metadata_json: Record<string, unknown> }) => ({
    sourceType: l.source_type,
    sourceRef: l.source_ref,
    metadata: l.metadata_json,
  }));

  const issueRow = issue as { detector_key?: string | null };

  const impact = impactSummaryRow
    ? {
        directRealizedLoss: (impactSummaryRow as { current_direct_realized_loss_amount: number | null }).current_direct_realized_loss_amount,
        revenueAtRisk: (impactSummaryRow as { current_revenue_at_risk_amount: number | null }).current_revenue_at_risk_amount,
        avoidedLoss: (impactSummaryRow as { current_avoided_loss_amount: number | null }).current_avoided_loss_amount,
        recoveredValue: (impactSummaryRow as { current_recovered_value_amount: number | null }).current_recovered_value_amount,
        operationalCost: (impactSummaryRow as { current_operational_cost_amount: number | null }).current_operational_cost_amount,
        confidenceScore: (impactSummaryRow as { current_confidence_score: number }).current_confidence_score,
        impactScore: (impactSummaryRow as { current_impact_score: number }).current_impact_score,
        currencyCode: (impactSummaryRow as { currency_code: string }).currency_code,
        lastCalculatedAt: (impactSummaryRow as { last_calculated_at: string }).last_calculated_at,
        modelKey: (impactSummaryRow as { last_model_key: string }).last_model_key,
        modelVersion: (impactSummaryRow as { last_model_version: string }).last_model_version,
      }
    : legacyImpactRow
      ? {
          directRealizedLoss: null,
          revenueAtRisk: (legacyImpactRow as { revenue_at_risk: number | null }).revenue_at_risk,
          avoidedLoss: null,
          recoveredValue: null,
          operationalCost: (legacyImpactRow as { operational_cost_estimate: number | null }).operational_cost_estimate,
          confidenceScore: (legacyImpactRow as { confidence_score: number | null }).confidence_score != null
            ? (legacyImpactRow as { confidence_score: number }).confidence_score > 1
              ? (legacyImpactRow as { confidence_score: number }).confidence_score
              : ((legacyImpactRow as { confidence_score: number }).confidence_score ?? 0) * 100
            : null,
          impactScore: null,
          currencyCode: "USD",
          lastCalculatedAt: null,
          modelKey: (legacyImpactRow as { model_key: string | null }).model_key,
          modelVersion: null,
        }
      : null;
  const impactUnknown = !impact && issue.verification_status === "pending";
  const assessment = assessmentRow as { calculation_breakdown_json?: Record<string, unknown>; assumptions_snapshot_json?: Record<string, unknown>; confidence_explanation_json?: Record<string, unknown> } | null;
  const moneyAtRisk = impact?.revenueAtRisk ?? impact?.directRealizedLoss ?? legacyImpactRow?.revenue_at_risk ?? null;
  const ownerLabel = issue.owner_team_key ?? (issue.owner_user_id ? `User ${issue.owner_user_id.slice(0, 8)}` : "Unassigned");
  const nextStep = nextStepForIssue(issue.status, issue.owner_user_id, issue.owner_team_key);
  const proofStatus =
    issue.verification_status === "passed"
      ? "Verified"
      : issue.verification_status === "failed"
        ? "Verification failed"
        : runs.length > 0
          ? `${runs.length} verification run${runs.length === 1 ? "" : "s"}`
          : evidence.length > 0
            ? `${evidence.length} proof item${evidence.length === 1 ? "" : "s"}`
            : "Proof needed";
  const issueSummary = issue.summary ?? issue.description ?? "Solvren detected a revenue-relevant problem that needs ownership, action, and proof.";
  const sourceLabel = issue.source_type.replaceAll("_", " ");

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <Phase3IssueReviewedTracker issueId={issueId} />

      <PageHeaderV2
        breadcrumbs={[
          { label: "Home", href: "/home" },
          { label: "Problems", href: "/issues" },
          { label: issue.issue_key },
        ]}
        title={issue.title}
        description="A plain-English problem record for revenue risk, ownership, action, proof, and outcome."
      />

      <PageActionBar
        ariaLabel="Problem sections"
        items={[
          { label: "Problem", href: "#problem" },
          { label: "Next action", href: "#next-action" },
          { label: "Impact", href: "#impact" },
          { label: "Owner", href: "#owner" },
          { label: "Proof", href: "#proof" },
          { label: "Details", href: "#details" },
        ]}
        actions={
          <>
            <Button asChild size="md">
              <Link href="#next-action">Review next action</Link>
            </Button>
            <Button asChild variant="secondary" size="md">
              <Link href="#proof">See proof</Link>
            </Button>
          </>
        }
      />

      <section id="problem" className="scroll-mt-28">
        <DecisionProblemBrief
          eyebrow="What happened"
          title={issueSummary}
          description="Solvren found a business problem that could affect revenue, customers, or delivery. This page shows why it matters, what should happen next, who owns it, and what proof exists."
          badges={
            <>
              <Badge variant={badgeTone(issue.status)}>{issueStatusLabel(issue.status)}</Badge>
              <Badge variant={severityTone(issue.severity)}>{issue.severity} severity</Badge>
              <Badge variant="outline">{sourceLabel}</Badge>
              {issue.domain_key ? <Badge variant="outline">{issue.domain_key}</Badge> : null}
            </>
          }
          metrics={[
            { label: "Why it matters", value: formatMoney(moneyAtRisk, impact?.currencyCode ?? "USD"), helper: "Current revenue exposure" },
            { label: "Who owns it", value: ownerLabel },
            { label: "What proof exists", value: proofStatus },
          ]}
          nextTitle="What should happen next"
          nextBody={nextStep}
          facts={[
            { label: "Problem key", value: issue.issue_key },
            { label: "Opened", value: new Date(issue.opened_at).toLocaleDateString() },
            { label: "Verification", value: issue.verification_status.replaceAll("_", " ") },
            { label: "Priority", value: issue.priority_score == null ? "Not scored" : Math.round(issue.priority_score) },
          ]}
          nextActions={
            <Button asChild variant="secondary" size="sm">
              <Link href="#next-action">Go to actions</Link>
            </Button>
          }
        />
      </section>

      <section id="next-action" className="scroll-mt-28 space-y-3">
        <SectionHeader title="What should happen next" helper="One clear action path first. Deeper operator controls remain available here." />
        <div className="grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(360px,0.6fr)]">
          <IssueDetailNextAction issue={issue as typeof issue & { approval_state?: string | null }} />
          <IssueActionsPanel issueId={issueId} issueTitle={issue.title} orgId={membership.org_id} connectedProviders={connectedProviders} revenueAtRisk={impact?.revenueAtRisk} />
        </div>
      </section>

      <section id="impact" className="scroll-mt-28 space-y-3">
        <SectionHeader title="Why it matters" helper="The business impact a leader needs before prioritizing the fix." />
        <IssueImpactSection
          impact={impact}
          impactUnknown={impactUnknown}
          issueId={issueId}
          calculationBreakdown={assessment?.calculation_breakdown_json ?? null}
          assumptionsSnapshot={assessment?.assumptions_snapshot_json ?? null}
          confidenceExplanation={assessment?.confidence_explanation_json ?? null}
        />
      </section>

      <section id="owner" className="scroll-mt-28 space-y-3">
        <SectionHeader title="Who owns it" helper="Owner, status, and recent activity so the problem does not drift." />
        <div className="grid gap-4 md:grid-cols-2">
          <IssueOwnerPanel issue={issue} />
          <IssueLifecyclePanel issueId={issueId} />
        </div>
      </section>

      <section id="proof" className="scroll-mt-28 space-y-3">
        <SectionHeader title="What proof exists" helper="Evidence, verification, and outcome records that show whether the problem is real and resolved." />
        <div className="grid gap-4 md:grid-cols-2">
          <IssueVerificationPanel verificationStatus={issue.verification_status} runs={runs} />
          <IssueEvidencePanel evidence={evidence} evidenceJson={evidenceJson} detectorKey={issueRow.detector_key} />
          <IssueOutcomePanel issueId={issueId} />
          <IssueLinksPanel changes={changes} entities={entities} />
        </div>
      </section>

      <details id="details" className="scroll-mt-28 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--bg-surface)] shadow-sm">
        <summary className="cursor-pointer px-[var(--card-spacer-x)] py-[var(--card-spacer-y)] font-semibold">
          Details for operators and auditors
          <span className="ml-2 text-sm font-normal text-[var(--text-muted)]">
            Source records, lineage, and technical context.
          </span>
        </summary>
        <div className="space-y-4 border-t border-[var(--border)] p-[var(--card-spacer-x)]">
          <IssueSourcePanel issue={issue} evidenceJson={evidenceJson} />
          <IssueLineagePanel lineage={lineage} />
        </div>
      </details>

      <section id="activity" className="scroll-mt-28 space-y-3">
        <SectionHeader title="Activity" helper="Timeline and comments for the people working the problem." />
        <div className="grid gap-4 md:grid-cols-2">
          <IssueTimelinePanel history={history} />
          <IssueCommentsPanel issueId={issueId} comments={comments} />
        </div>
      </section>

      {issue.description && (
        <Card>
          <CardHeader>
            <CardTitle>Original description</CardTitle>
            <CardDescription>Raw context captured when the problem was created.</CardDescription>
          </CardHeader>
          <CardBody>
            <p className="whitespace-pre-wrap text-sm leading-6">{issue.description}</p>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
