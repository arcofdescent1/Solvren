/**
 * Phase 4 — Detector registry (§10).
 */
import type { IDetector } from "../detectors/base/detector.interface";
import { FailedPaymentUnrecoveredDetector } from "../detectors/revenue-leakage/failed-payment-unrecovered.detector";
import { InvoicePastDueDetector } from "../detectors/revenue-leakage/invoice-past-due.detector";
import { SubscriptionCanceledAfterFailedPaymentDetector } from "../detectors/revenue-leakage/subscription-canceled-after-failed-payment.detector";
import { PaymentFailureSpikeDetector } from "../detectors/revenue-leakage/payment-failure-spike.detector";
import { QualifiedLeadUnworkedDetector } from "../detectors/funnel-protection/qualified-lead-unworked.detector";
import { OpportunityStalledDetector } from "../detectors/funnel-protection/opportunity-stalled.detector";
import { MeetingMissingAfterQualificationDetector } from "../detectors/funnel-protection/meeting-missing-after-qualification.detector";
import { NoShowWithoutFollowupDetector } from "../detectors/funnel-protection/no-show-without-followup.detector";
import { DuplicateContactClusterDetector } from "../detectors/data-integrity/duplicate-contact-cluster.detector";
import { OpportunityMissingSourceAttributionDetector } from "../detectors/data-integrity/opportunity-missing-source-attribution.detector";
import { OwnerMissingRevenueRecordDetector } from "../detectors/data-integrity/owner-missing-revenue-record.detector";
import { WorkflowSyncDriftDetector } from "../detectors/data-integrity/workflow-sync-drift.detector";
import { RevenueChangeMissingApprovalDetector } from "../detectors/change-risk/revenue-change-missing-approval.detector";
import { HighRiskChangeMissingEvidenceDetector } from "../detectors/change-risk/high-risk-change-missing-evidence.detector";
import { ChangeFollowedByIncidentDetector } from "../detectors/change-risk/change-followed-by-incident.detector";
import { UnsafeChangeConcentrationDetector } from "../detectors/change-risk/unsafe-change-concentration.detector";

const detectors: Map<string, IDetector> = new Map();

function register(d: IDetector) {
  detectors.set(d.detectorKey, d);
}

// Revenue Leakage (Pack A)
register(new FailedPaymentUnrecoveredDetector());
register(new InvoicePastDueDetector());
register(new SubscriptionCanceledAfterFailedPaymentDetector());
register(new PaymentFailureSpikeDetector());

// Funnel Protection (Pack B)
register(new QualifiedLeadUnworkedDetector());
register(new OpportunityStalledDetector());
register(new MeetingMissingAfterQualificationDetector());
register(new NoShowWithoutFollowupDetector());

// Data Integrity (Pack C)
register(new DuplicateContactClusterDetector());
register(new OpportunityMissingSourceAttributionDetector());
register(new OwnerMissingRevenueRecordDetector());
register(new WorkflowSyncDriftDetector());

// Change Risk (Pack D)
register(new RevenueChangeMissingApprovalDetector());
register(new HighRiskChangeMissingEvidenceDetector());
register(new ChangeFollowedByIncidentDetector());
register(new UnsafeChangeConcentrationDetector());

export function getDetector(detectorKey: string): IDetector | undefined {
  return detectors.get(detectorKey);
}

export function getDetectorsForSignal(signalKey: string): IDetector[] {
  const result: IDetector[] = [];
  for (const d of detectors.values()) {
    // Detector subscription is defined in definitions; we match by detector key
    // For now return all; subscription service will filter by required_signal_keys
    result.push(d);
  }
  return result;
}

export function getAllDetectors(): IDetector[] {
  return Array.from(detectors.values());
}
