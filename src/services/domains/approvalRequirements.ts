import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Phase 3: DB-driven domain approval requirements.
 * Optional: add org overrides later via a new table (org_approval_overrides).
 */
export async function getApprovalRequirementsForChange(
  supabase: SupabaseClient,
  args: { orgId: string; domainKey: string }
) {
  const { orgId, domainKey } = args;

  const { data: reqs, error } = await supabase
    .from("domain_approval_requirements")
    .select("approval_area, required_kinds, required_approvals, config")
    .eq("domain_key", domainKey);

  if (error) throw new Error(error.message);

  return (reqs ?? []).map((r: Record<string, unknown>) => ({
    approvalArea: String(r.approval_area ?? ""),
    requiredKinds: Array.isArray(r.required_kinds) ? (r.required_kinds as string[]) : [],
    requiredApprovals: Number(r.required_approvals ?? 1),
    config: (r.config ?? {}) as Record<string, unknown>,
    orgId,
    domainKey,
  }));
}

/** Convenience: required approval areas + union of required evidence kinds from domain_approval_requirements. */
export async function getRequiredEvidenceAndApprovalAreas(
  supabase: SupabaseClient,
  args: { orgId: string; domainKey: string }
) {
  const reqs = await getApprovalRequirementsForChange(supabase, args);
  const requiredApprovalAreas = reqs.map((r) => r.approvalArea);
  const requiredEvidenceKinds = [
    ...new Set(reqs.flatMap((r) => r.requiredKinds).filter(Boolean)),
  ];
  return { requiredApprovalAreas, requiredEvidenceKinds };
}
