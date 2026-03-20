/**
 * Phase 0 — Issue detail with full panels.
 */
import { redirect, notFound } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getIssueDetail } from "@/modules/issues";
import { getLatestAssessmentForIssue } from "@/modules/impact/persistence/impact-assessments.repository";
import { getAccountsByOrg } from "@/modules/integrations/core/integrationAccountsRepo";
import { Card, CardBody } from "@/ui";
import {
  IssueDetailHeader,
  IssueSourcePanel,
  IssueLinksPanel,
  IssueTimelinePanel,
  IssueVerificationPanel,
  IssueCommentsPanel,
  IssueOwnerPanel,
  IssueActionsPanel,
  IssueOutcomePanel,
  IssueLifecyclePanel,
} from "@/components/issues";
import { IssueImpactSection } from "@/components/impact";

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
    { data: impactSummaryRow },
    { data: legacyImpactRow },
    { data: assessmentRow },
  ] = await Promise.all([
    supabase.from("issue_sources").select("evidence_json").eq("issue_id", issueId).limit(1).maybeSingle(),
    supabase.from("issue_history").select("id, event_type, event_actor_ref, created_at, new_state_json").eq("issue_id", issueId).order("created_at", { ascending: false }).limit(50),
    supabase.from("verification_runs").select("id, verification_type, status, started_at, completed_at, result_summary").eq("issue_id", issueId).order("started_at", { ascending: false }).limit(20),
    supabase.from("issue_comments").select("id, body, author_user_id, created_at").eq("issue_id", issueId).order("created_at", { ascending: false }).limit(50),
    supabase.from("change_issue_links").select("change_id, link_type").eq("issue_id", issueId),
    supabase.from("issue_entities").select("entity_type, external_system, external_id, entity_display_name").eq("issue_id", issueId).limit(20),
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
    const { data: changeData } = await supabase.from("change_events").select("id, title").in("id", changeIds);
    changeTitles = new Map((changeData ?? []).map((c: { id: string; title: string | null }) => [c.id, c.title ?? ""]));
  }
  const changes = (linkRows ?? []).map((l: { change_id: string; link_type: string }) => ({
    changeId: l.change_id,
    linkType: l.link_type,
    title: changeTitles.get(l.change_id),
  }));
  const entities = (entityRows ?? []).map((e: { entity_type: string; external_system: string; external_id: string; entity_display_name: string | null }) => ({
    entityType: e.entity_type,
    externalSystem: e.external_system,
    externalId: e.external_id,
    displayName: e.entity_display_name,
  }));

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

  return (
    <div className="flex flex-col gap-6">
      <IssueDetailHeader issue={issue} />
      <div className="grid gap-4 md:grid-cols-2">
        <IssueOwnerPanel issue={issue} />
        <IssueLifecyclePanel issueId={issueId} />
        <IssueImpactSection
          impact={impact}
          impactUnknown={impactUnknown}
          issueId={issueId}
          calculationBreakdown={assessment?.calculation_breakdown_json ?? null}
          assumptionsSnapshot={assessment?.assumptions_snapshot_json ?? null}
          confidenceExplanation={assessment?.confidence_explanation_json ?? null}
        />
      </div>
      <IssueSourcePanel issue={issue} evidenceJson={evidenceJson} />
      <IssueLinksPanel changes={changes} entities={entities} />
      <div className="grid gap-4 md:grid-cols-2">
        <IssueTimelinePanel history={history} />
        <IssueVerificationPanel verificationStatus={issue.verification_status} runs={runs} />
        <IssueActionsPanel issueId={issueId} issueTitle={issue.title} orgId={membership.org_id} connectedProviders={connectedProviders} revenueAtRisk={impact?.revenueAtRisk} />
        <IssueOutcomePanel issueId={issueId} />
      </div>
      {issue.description && (
        <Card>
          <CardBody>
            <h3 className="text-sm font-medium text-[var(--text-muted)] mb-2">Description</h3>
            <p className="text-sm whitespace-pre-wrap">{issue.description}</p>
          </CardBody>
        </Card>
      )}
      <IssueCommentsPanel issueId={issueId} comments={comments} />
    </div>
  );
}
