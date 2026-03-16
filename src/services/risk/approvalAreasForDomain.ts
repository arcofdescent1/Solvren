/**
 * @deprecated Use getApprovalRequirementsForChange from @/services/domains/approvalRequirements.
 */
export function approvalAreasForDomain(_domain: string): readonly string[] {
  throw new Error(
    "approvalAreasForDomain deprecated — use domain_approval_requirements via getApprovalRequirementsForChange"
  );
}

/** @deprecated Use domain_approval_requirements resolver. */
export const APPROVAL_AREA_TO_ROLE: Record<string, string> = {};
