import type { EvidenceKind } from "@/services/risk/requirements";
import type { RiskBucket } from "@/services/risk/requirements";
import type { RiskDomain } from "@/types/risk";

/**
 * @deprecated Use getApprovalRequirementsForChange; union required_kinds across all approval areas.
 */
export function requiredEvidenceFor(
  _domain: RiskDomain,
  _bucket: RiskBucket
): EvidenceKind[] {
  throw new Error(
    "requirementsForDomain requiredEvidenceFor deprecated — use domain_approval_requirements via getApprovalRequirementsForChange"
  );
}
