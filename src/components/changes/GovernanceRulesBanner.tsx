/**
 * Hero Workflow 1 — Governance Rules Applied
 * Shows which approval policies matched and required approvers.
 */
import { evaluateApprovalPolicies } from "@/lib/governance/ApprovalPolicyEngine";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { Card, CardBody } from "@/ui";

type Props = {
  orgId: string;
  changeType?: string | null;
  impactAmount?: number | null;
  domain?: string | null;
  riskBucket?: string | null;
};

export async function GovernanceRulesBanner({
  orgId,
  changeType,
  impactAmount,
  domain,
  riskBucket,
}: Props) {
  const supabase = await createServerSupabaseClient();
  const required = await evaluateApprovalPolicies(supabase, orgId, {
    changeType: changeType ?? undefined,
    impactAmount: impactAmount != null ? Number(impactAmount) : undefined,
    domain: domain ?? undefined,
    riskBucket: riskBucket ?? undefined,
  });

  if (required.length === 0) return null;

  return (
    <Card className="border-[var(--primary)]/30 bg-[var(--primary)]/5">
      <CardBody className="py-3">
        <p className="text-sm font-medium text-[var(--text)]">
          Governance rules applied — required approvers:
        </p>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          {required.map((r) => `${r.role}${r.minCount > 1 ? ` (×${r.minCount})` : ""}`).join(", ")}
        </p>
      </CardBody>
    </Card>
  );
}
