/**
 * Phase 5 — Impact model registry (§7).
 */
import type { IImpactModel } from "../models/base/impact-model.interface";
import { FailedPaymentUnrecoveredImpactModel } from "../models/revenue-leakage/failed-payment-unrecovered.model";
import { InvoicePastDueHighValueImpactModel } from "../models/revenue-leakage/invoice-past-due-high-value.model";
import { SubscriptionCanceledAfterFailedPaymentImpactModel } from "../models/revenue-leakage/subscription-canceled-after-failed-payment.model";
import { PaymentFailureSpikeImpactModel } from "../models/revenue-leakage/payment-failure-spike.model";
import { QualifiedLeadUnworkedImpactModel } from "../models/funnel-protection/qualified-lead-unworked.model";
import { OpportunityStalledInStageImpactModel } from "../models/funnel-protection/opportunity-stalled-in-stage.model";
import { MeetingMissingAfterQualificationImpactModel } from "../models/funnel-protection/meeting-missing-after-qualification.model";
import { NoShowWithoutFollowupImpactModel } from "../models/funnel-protection/no-show-without-followup.model";
import { DuplicateContactClusterImpactModel } from "../models/data-integrity/duplicate-contact-cluster.model";
import { OpportunityMissingSourceAttributionImpactModel } from "../models/data-integrity/opportunity-missing-source-attribution.model";
import { OwnerMissingRevenueRecordImpactModel } from "../models/data-integrity/owner-missing-revenue-record.model";
import { WorkflowSyncDriftImpactModel } from "../models/data-integrity/workflow-sync-drift.model";
import { RevenueChangeMissingApprovalImpactModel } from "../models/change-risk/revenue-change-missing-approval.model";
import { HighRiskChangeMissingEvidenceImpactModel } from "../models/change-risk/high-risk-change-missing-evidence.model";
import { ChangeFollowedByIncidentImpactModel } from "../models/change-risk/change-followed-by-incident.model";
import { UnsafeChangeConcentrationImpactModel } from "../models/change-risk/unsafe-change-concentration.model";

const models: Map<string, IImpactModel> = new Map();

function register(m: IImpactModel) {
  models.set(m.modelKey, m);
}

register(new FailedPaymentUnrecoveredImpactModel());
register(new InvoicePastDueHighValueImpactModel());
register(new SubscriptionCanceledAfterFailedPaymentImpactModel());
register(new PaymentFailureSpikeImpactModel());
register(new QualifiedLeadUnworkedImpactModel());
register(new OpportunityStalledInStageImpactModel());
register(new MeetingMissingAfterQualificationImpactModel());
register(new NoShowWithoutFollowupImpactModel());
register(new DuplicateContactClusterImpactModel());
register(new OpportunityMissingSourceAttributionImpactModel());
register(new OwnerMissingRevenueRecordImpactModel());
register(new WorkflowSyncDriftImpactModel());
register(new RevenueChangeMissingApprovalImpactModel());
register(new HighRiskChangeMissingEvidenceImpactModel());
register(new ChangeFollowedByIncidentImpactModel());
register(new UnsafeChangeConcentrationImpactModel());

export function getImpactModel(modelKey: string): IImpactModel | undefined {
  return models.get(modelKey);
}
