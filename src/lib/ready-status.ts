import type { SupabaseClient } from "@supabase/supabase-js";
import type { RiskDomain } from "@/types/risk";
import type { RiskBucket } from "@/services/risk/requirements";
import { getReadyStatus as getReadyStatusV2 } from "@/services/risk/readyStatus";

export type ReadyStatusResult = {
  changeId: string;
  orgId: string;
  domain: RiskDomain;
  bucket: RiskBucket | null;
  ready: boolean;
  missingEvidence: string[];
  missingApprovals: string[];
  blockingIncidents: { id: string; status: string | null }[];
};

/**
 * Server-side readiness for a change: assessment exists, required evidence present,
 * required approval areas assigned, no open (non-resolved) incidents.
 * Returns null if change not found or user not in org.
 */
export async function getReadyStatus(
  supabase: SupabaseClient,
  changeId: string,
  userId: string
): Promise<ReadyStatusResult | null> {
  // Deprecated wrapper: use the canonical readiness engine in services/risk/readyStatus.
  // Keep this to avoid churn in older UI callers.

  const { data: change, error: ceErr } = await supabase
    .from("change_events")
    .select("id, org_id")
    .eq("id", changeId)
    .maybeSingle();
  if (ceErr) throw new Error(ceErr.message);
  if (!change) return null;

  const { data: member } = await supabase
    .from("organization_members")
    .select("org_id")
    .eq("org_id", change.org_id)
    .eq("user_id", userId)
    .maybeSingle();
  if (!member) return null;

  const res = await getReadyStatusV2(supabase, { changeId });
  return {
    changeId,
    orgId: String(change.org_id),
    domain: res.domain as RiskDomain,
    bucket: (res.bucket ?? null) as RiskBucket | null,
    ready: res.ready,
    missingEvidence: res.missingEvidence,
    missingApprovals: res.missingApprovalAreas,
    blockingIncidents: res.blockingIncidents,
  };
}
