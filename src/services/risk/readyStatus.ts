import { getApprovalRequirementsForChange } from "@/services/domains/approvalRequirements";
import { getGovernanceTemplate } from "@/services/risk/governance";
import { evaluateEvidenceStatus } from "@/services/evidence";
import { isRiskDomain, type RiskDomain } from "@/types/risk";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { RiskBucket } from "@/services/risk/requirements";

export type MissingApproval = { role: string; missing: number };

export type ReadyStatus = {
  ready: boolean;
  domain: string;
  bucket: string | null;
  missingEvidence: string[];
  missingApprovalAreas: string[];
  missingApprovals: MissingApproval[];
  blockingIncidents: Array<{ id: string; status: string | null }>;
  /** Task 14: when true, approval blocked due to required evidence */
  approvalBlockedMissingEvidence?: boolean;
  coordinationBlockingErrors?: string[];
};

export async function getMissingApprovalsFromRequirements(
  supabase: SupabaseClient,
  args: {
    orgId: string;
    changeId: string;
    domain: string;
    riskBucket: string;
    slaStatus?: string | null;
  }
): Promise<MissingApproval[]> {
  const { orgId, changeId, domain, riskBucket, slaStatus } = args;

  const { data: reqs, error: reqErr } = await supabase
    .from("approval_requirements")
    .select("required_role, min_count")
    .eq("org_id", orgId)
    .eq("domain", domain)
    .eq("risk_bucket", riskBucket)
    .eq("enabled", true);

  if (reqErr) throw new Error(reqErr.message);

  const required: { role: string; min: number }[] = (reqs ?? []).map((r) => ({
    role: String(r.required_role),
    min: Number(r.min_count ?? 1),
  }));

  const isEscalated = String(slaStatus ?? "") === "ESCALATED";
  const hasExec = required.some((r) => r.role === "EXEC");
  if (isEscalated && !hasExec) required.push({ role: "EXEC", min: 1 });

  const { data: approvals, error: apprErr } = await supabase
    .from("approvals")
    .select("approval_area")
    .eq("change_event_id", changeId);

  if (apprErr) throw new Error(apprErr.message);

  const assignedMap = new Map<string, number>();
  for (const a of approvals ?? []) {
    const role = String(a.approval_area ?? "General");
    assignedMap.set(role, (assignedMap.get(role) ?? 0) + 1);
  }

  return required
    .map((r) => {
      const have = assignedMap.get(r.role) ?? 0;
      return { role: r.role, missing: Math.max(0, r.min - have) };
    })
    .filter((m) => m.missing > 0);
}

export async function getReadyStatus(
  supabase: SupabaseClient,
  args: { changeId: string }
): Promise<ReadyStatus> {
  const { changeId } = args;

  const { data: change, error: ceErr } = await supabase
    .from("change_events")
    .select("id, org_id, domain, sla_status")
    .eq("id", changeId)
    .single();

  if (ceErr || !change) {
    throw new Error(ceErr?.message ?? "Change not found");
  }

  const { data: latestAssessment } = await supabase
    .from("impact_assessments")
    .select("risk_bucket, created_at")
    .eq("change_event_id", changeId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const bucket = (latestAssessment?.risk_bucket ?? null) as RiskBucket | null;

  const domain = (isRiskDomain(String(change.domain))
    ? (change.domain as RiskDomain)
    : "REVENUE") as RiskDomain;
  const domainKey = String(domain);
  const orgId = change.org_id as string;

  let requiredEvidence: string[] = [];
  let missingApprovals: MissingApproval[] = [];

  try {
    const domainReqs = await getApprovalRequirementsForChange(supabase, {
      orgId,
      domainKey,
    });
    if (domainReqs.length > 0) {
      requiredEvidence = [
        ...new Set(domainReqs.flatMap((r) => r.requiredKinds).filter(Boolean)),
      ];
      const required = domainReqs.map((r) => ({
        role: r.approvalArea,
        min: r.requiredApprovals,
      }));
      const isEscalated =
        String((change as { sla_status?: string | null }).sla_status ?? "") ===
        "ESCALATED";
      if (isEscalated && !required.some((r) => r.role === "EXEC")) {
        required.push({ role: "EXEC", min: 1 });
      }
      const { data: approvals } = await supabase
        .from("approvals")
        .select("approval_area")
        .eq("change_event_id", changeId);
      const assignedMap = new Map<string, number>();
      for (const a of approvals ?? []) {
        const role = String(a.approval_area ?? "General");
        assignedMap.set(role, (assignedMap.get(role) ?? 0) + 1);
      }
      missingApprovals = required
        .map((r) => {
          const have = assignedMap.get(r.role) ?? 0;
          return { role: r.role, missing: Math.max(0, r.min - have) };
        })
        .filter((m) => m.missing > 0);
    }
  } catch {
    // Fall through to legacy path
  }

  if (requiredEvidence.length === 0 && missingApprovals.length === 0) {
    const tpl = bucket
      ? await getGovernanceTemplate(supabase, domain, bucket)
      : null;
    requiredEvidence = (tpl?.required_evidence_kinds ?? []) as string[];
    missingApprovals = await getMissingApprovalsFromRequirements(supabase, {
      orgId,
      changeId,
      domain: domainKey,
      riskBucket: bucket ? String(bucket) : "MEDIUM",
      slaStatus: (change as { sla_status?: string | null }).sla_status ?? null,
    });
  }

  // Task 14: Prefer change_evidence_items for enforcement (required items must be PROVIDED/WAIVED)
  let missingEvidence: string[] = [];
  let approvalBlockedMissingEvidence = false;
  try {
    const evidenceStatus = await evaluateEvidenceStatus(supabase, changeId);
    if (evidenceStatus.items.length > 0) {
      missingEvidence = evidenceStatus.missingRequired;
      approvalBlockedMissingEvidence = evidenceStatus.approvalBlocked;
    }
  } catch {
    // Fall through to legacy
  }

  // Legacy: when no evidence items, use change_evidence + governance required kinds
  if (missingEvidence.length === 0 && requiredEvidence.length > 0) {
    const { data: evidence } = await supabase
      .from("change_evidence")
      .select("kind")
      .eq("change_event_id", changeId);
    const presentEvidence = new Set((evidence ?? []).map((e) => e.kind));
    missingEvidence = requiredEvidence.filter((k) => !presentEvidence.has(k));
    approvalBlockedMissingEvidence = missingEvidence.length > 0;
  }
  const missingApprovalAreas = missingApprovals.map((m) =>
    m.missing > 1 ? `${m.role} (missing ${m.missing})` : m.role
  );

  const { data: incidents } = await supabase
    .from("incidents")
    .select("id, status")
    .eq("change_event_id", changeId);

  const blockingIncidents = (incidents ?? [])
    .filter(
      (i: { status?: string | null }) =>
        String(i.status ?? "").toUpperCase() !== "RESOLVED"
    )
    .map((i: { id: string; status?: string | null }) => ({
      id: i.id as string,
      status: (i.status ?? null) as string | null,
    }));

  let coordinationBlockingErrors: string[] = [];
  try {
    const { data: coordination } = await supabase
      .from("coordination_plans")
      .select("plan_json")
      .eq("change_id", changeId)
      .eq("is_current", true)
      .maybeSingle();
    const blockers = (coordination?.plan_json as { blockers?: Array<{ severity?: string; title?: string }> } | null)
      ?.blockers;
    coordinationBlockingErrors = (blockers ?? [])
      .filter((b) => String(b.severity ?? "") === "ERROR")
      .map((b) => String(b.title ?? "Coordination blocker"));
  } catch {
    coordinationBlockingErrors = [];
  }

  const ready =
    !!bucket &&
    missingEvidence.length === 0 &&
    missingApprovals.length === 0 &&
    blockingIncidents.length === 0 &&
    coordinationBlockingErrors.length === 0;

  return {
    ready,
    approvalBlockedMissingEvidence: approvalBlockedMissingEvidence || undefined,
    domain,
    bucket: bucket ? String(bucket) : null,
    missingEvidence,
    missingApprovalAreas,
    missingApprovals,
    blockingIncidents,
    coordinationBlockingErrors,
  };
}
