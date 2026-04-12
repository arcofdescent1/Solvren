/**
 * Phase 10 — org_onboarding_states repository.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { OnboardingState } from "../domain";

export type OrgOnboardingStateRow = {
  org_id: string;
  onboarding_state: string;
  first_value_reached: boolean;
  first_value_at: string | null;
  activated_at: string | null;
  current_step_key: string | null;
  integrations_connected?: boolean;
  first_signal_received?: boolean;
  first_issue_detected?: boolean;
  first_action_executed?: boolean;
  first_value_verified?: boolean;
  onboarding_stage?: string | null;
  guided_flow_version?: string | null;
  guided_phase1_status?: string | null;
  guided_current_step_key?: string | null;
  company_size?: string | null;
  industry?: string | null;
  primary_goal?: string | null;
  selected_use_cases?: unknown;
  latest_baseline_scan_id?: string | null;
  first_insight_summary?: Record<string, unknown> | null;
  results_screen_viewed_at?: string | null;
  phase2_status?: string | null;
  phase2_current_step?: string | null;
  phase2_started_at?: string | null;
  phase2_completed_at?: string | null;
  accepted_member_count_excluding_owner?: number;
  enabled_workflow_count?: number;
  configured_alert_channel_count?: number;
  configured_approval_rule_count?: number;
  first_alert_delivered_at?: string | null;
  first_alert_delivery_channel?: string | null;
  first_operational_event_at?: string | null;
  first_operational_event_type?: string | null;
  first_operational_event_id?: string | null;
  phase3_status?: string | null;
  phase3_current_step?: string | null;
  phase3_started_at?: string | null;
  phase3_completed_at?: string | null;
  expanded_integration_count?: number;
  active_department_count?: number;
  executive_engagement_at?: string | null;
  executive_engaged_user_id?: string | null;
  first_value_story_id?: string | null;
  phase3_active_weeks?: number;
  phase3_usage_interaction_count?: number;
  phase3_baseline_connected_integrations?: number;
  phase3_baseline_enabled_workflows?: number;
  phase4_status?: string | null;
  phase4_current_step?: string | null;
  phase4_started_at?: string | null;
  phase4_completed_at?: string | null;
  phase4_expanded_unit_count?: number;
  phase4_connected_integrations?: number;
  phase4_enabled_workflows?: number;
  phase4_consecutive_executive_weeks?: number;
  phase4_system_of_record_confirmed?: boolean;
  phase4_renewal_score?: number;
  phase4_expansion_recommendation_count?: number;
  phase4_baseline_business_unit_count?: number;
  created_at: string;
  updated_at: string;
};

export async function getOrgOnboardingState(
  supabase: SupabaseClient,
  orgId: string
): Promise<{ data: OrgOnboardingStateRow | null; error: Error | null }> {
  const { data, error } = await supabase
    .from("org_onboarding_states")
    .select("*")
    .eq("org_id", orgId)
    .maybeSingle();
  return { data: data as OrgOnboardingStateRow | null, error: error as Error | null };
}

export async function upsertOrgOnboardingState(
  supabase: SupabaseClient,
  input: {
    orgId: string;
    onboardingState?: OnboardingState;
    firstValueReached?: boolean;
    firstValueAt?: string | null;
    activatedAt?: string | null;
    currentStepKey?: string | null;
    guidedFlowVersion?: string | null;
    guidedPhase1Status?: string | null;
    guidedCurrentStepKey?: string | null;
    companySize?: string | null;
    industry?: string | null;
    primaryGoal?: string | null;
    selectedUseCases?: unknown[];
    latestBaselineScanId?: string | null;
    firstInsightSummary?: Record<string, unknown> | null;
    resultsScreenViewedAt?: string | null;
    phase2Status?: string | null;
    phase2CurrentStep?: string | null;
    phase2StartedAt?: string | null;
    phase2CompletedAt?: string | null;
    acceptedMemberCountExcludingOwner?: number;
    enabledWorkflowCount?: number;
    configuredAlertChannelCount?: number;
    configuredApprovalRuleCount?: number;
    firstAlertDeliveredAt?: string | null;
    firstAlertDeliveryChannel?: string | null;
    firstOperationalEventAt?: string | null;
    firstOperationalEventType?: string | null;
    firstOperationalEventId?: string | null;
    phase3Status?: string | null;
    phase3CurrentStep?: string | null;
    phase3StartedAt?: string | null;
    phase3CompletedAt?: string | null;
    expandedIntegrationCount?: number;
    activeDepartmentCount?: number;
    executiveEngagementAt?: string | null;
    executiveEngagedUserId?: string | null;
    firstValueStoryId?: string | null;
    phase3ActiveWeeks?: number;
    phase3UsageInteractionCount?: number;
    phase3BaselineConnectedIntegrations?: number;
    phase3BaselineEnabledWorkflows?: number;
    phase4Status?: string | null;
    phase4CurrentStep?: string | null;
    phase4StartedAt?: string | null;
    phase4CompletedAt?: string | null;
    phase4ExpandedUnitCount?: number;
    phase4ConnectedIntegrations?: number;
    phase4EnabledWorkflows?: number;
    phase4ConsecutiveExecutiveWeeks?: number;
    phase4SystemOfRecordConfirmed?: boolean;
    phase4RenewalScore?: number;
    phase4ExpansionRecommendationCount?: number;
    phase4BaselineBusinessUnitCount?: number;
  }
): Promise<{ error: Error | null }> {
  const row: Record<string, unknown> = {
    org_id: input.orgId,
    updated_at: new Date().toISOString(),
  };
  if (input.onboardingState != null) row.onboarding_state = input.onboardingState;
  if (input.firstValueReached != null) row.first_value_reached = input.firstValueReached;
  if (input.firstValueAt !== undefined) row.first_value_at = input.firstValueAt;
  if (input.activatedAt !== undefined) row.activated_at = input.activatedAt;
  if (input.currentStepKey !== undefined) row.current_step_key = input.currentStepKey;
  if (input.guidedFlowVersion !== undefined) row.guided_flow_version = input.guidedFlowVersion;
  if (input.guidedPhase1Status !== undefined) row.guided_phase1_status = input.guidedPhase1Status;
  if (input.guidedCurrentStepKey !== undefined) row.guided_current_step_key = input.guidedCurrentStepKey;
  if (input.companySize !== undefined) row.company_size = input.companySize;
  if (input.industry !== undefined) row.industry = input.industry;
  if (input.primaryGoal !== undefined) row.primary_goal = input.primaryGoal;
  if (input.selectedUseCases !== undefined) row.selected_use_cases = input.selectedUseCases;
  if (input.latestBaselineScanId !== undefined) row.latest_baseline_scan_id = input.latestBaselineScanId;
  if (input.firstInsightSummary !== undefined) row.first_insight_summary = input.firstInsightSummary;
  if (input.resultsScreenViewedAt !== undefined) row.results_screen_viewed_at = input.resultsScreenViewedAt;
  if (input.phase2Status !== undefined) row.phase2_status = input.phase2Status;
  if (input.phase2CurrentStep !== undefined) row.phase2_current_step = input.phase2CurrentStep;
  if (input.phase2StartedAt !== undefined) row.phase2_started_at = input.phase2StartedAt;
  if (input.phase2CompletedAt !== undefined) row.phase2_completed_at = input.phase2CompletedAt;
  if (input.acceptedMemberCountExcludingOwner !== undefined) {
    row.accepted_member_count_excluding_owner = input.acceptedMemberCountExcludingOwner;
  }
  if (input.enabledWorkflowCount !== undefined) row.enabled_workflow_count = input.enabledWorkflowCount;
  if (input.configuredAlertChannelCount !== undefined) {
    row.configured_alert_channel_count = input.configuredAlertChannelCount;
  }
  if (input.configuredApprovalRuleCount !== undefined) {
    row.configured_approval_rule_count = input.configuredApprovalRuleCount;
  }
  if (input.firstAlertDeliveredAt !== undefined) row.first_alert_delivered_at = input.firstAlertDeliveredAt;
  if (input.firstAlertDeliveryChannel !== undefined) {
    row.first_alert_delivery_channel = input.firstAlertDeliveryChannel;
  }
  if (input.firstOperationalEventAt !== undefined) row.first_operational_event_at = input.firstOperationalEventAt;
  if (input.firstOperationalEventType !== undefined) {
    row.first_operational_event_type = input.firstOperationalEventType;
  }
  if (input.firstOperationalEventId !== undefined) row.first_operational_event_id = input.firstOperationalEventId;
  if (input.phase3Status !== undefined) row.phase3_status = input.phase3Status;
  if (input.phase3CurrentStep !== undefined) row.phase3_current_step = input.phase3CurrentStep;
  if (input.phase3StartedAt !== undefined) row.phase3_started_at = input.phase3StartedAt;
  if (input.phase3CompletedAt !== undefined) row.phase3_completed_at = input.phase3CompletedAt;
  if (input.expandedIntegrationCount !== undefined) row.expanded_integration_count = input.expandedIntegrationCount;
  if (input.activeDepartmentCount !== undefined) row.active_department_count = input.activeDepartmentCount;
  if (input.executiveEngagementAt !== undefined) row.executive_engagement_at = input.executiveEngagementAt;
  if (input.executiveEngagedUserId !== undefined) row.executive_engaged_user_id = input.executiveEngagedUserId;
  if (input.firstValueStoryId !== undefined) row.first_value_story_id = input.firstValueStoryId;
  if (input.phase3ActiveWeeks !== undefined) row.phase3_active_weeks = input.phase3ActiveWeeks;
  if (input.phase3UsageInteractionCount !== undefined) {
    row.phase3_usage_interaction_count = input.phase3UsageInteractionCount;
  }
  if (input.phase3BaselineConnectedIntegrations !== undefined) {
    row.phase3_baseline_connected_integrations = input.phase3BaselineConnectedIntegrations;
  }
  if (input.phase3BaselineEnabledWorkflows !== undefined) {
    row.phase3_baseline_enabled_workflows = input.phase3BaselineEnabledWorkflows;
  }
  if (input.phase4Status !== undefined) row.phase4_status = input.phase4Status;
  if (input.phase4CurrentStep !== undefined) row.phase4_current_step = input.phase4CurrentStep;
  if (input.phase4StartedAt !== undefined) row.phase4_started_at = input.phase4StartedAt;
  if (input.phase4CompletedAt !== undefined) row.phase4_completed_at = input.phase4CompletedAt;
  if (input.phase4ExpandedUnitCount !== undefined) row.phase4_expanded_unit_count = input.phase4ExpandedUnitCount;
  if (input.phase4ConnectedIntegrations !== undefined) {
    row.phase4_connected_integrations = input.phase4ConnectedIntegrations;
  }
  if (input.phase4EnabledWorkflows !== undefined) row.phase4_enabled_workflows = input.phase4EnabledWorkflows;
  if (input.phase4ConsecutiveExecutiveWeeks !== undefined) {
    row.phase4_consecutive_executive_weeks = input.phase4ConsecutiveExecutiveWeeks;
  }
  if (input.phase4SystemOfRecordConfirmed !== undefined) {
    row.phase4_system_of_record_confirmed = input.phase4SystemOfRecordConfirmed;
  }
  if (input.phase4RenewalScore !== undefined) row.phase4_renewal_score = input.phase4RenewalScore;
  if (input.phase4ExpansionRecommendationCount !== undefined) {
    row.phase4_expansion_recommendation_count = input.phase4ExpansionRecommendationCount;
  }
  if (input.phase4BaselineBusinessUnitCount !== undefined) {
    row.phase4_baseline_business_unit_count = input.phase4BaselineBusinessUnitCount;
  }

  const { error } = await supabase.from("org_onboarding_states").upsert(row, { onConflict: "org_id" });
  return { error: error as Error | null };
}
