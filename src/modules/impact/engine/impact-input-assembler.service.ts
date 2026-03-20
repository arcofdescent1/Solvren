/**
 * Phase 5 — Impact input assembler (§6).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { getEffectiveAssumptions } from "../persistence/org-impact-assumptions.repository";
import { getDetectorFindingById } from "@/modules/detection/persistence/detector-findings.repository";
import { getIssueDetail } from "@/modules/issues";
import { listNormalizedSignals } from "@/modules/signals/persistence/normalized-signals.repository";
import { DEFAULT_ASSUMPTION_KEYS } from "../domain/assumption-set";

export type AssembledInputs = {
  orgId: string;
  issueId: string | null;
  findingId: string | null;
  detectorKey: string | null;
  evidenceBundle: Record<string, unknown>;
  signals: Array<{
    id: string;
    signal_key: string;
    signal_time: string;
    dimensions_json: Record<string, unknown>;
    measures_json: Record<string, unknown>;
    references_json: Record<string, unknown>;
  }>;
  assumptions: Record<string, number | string | boolean>;
};

const DEFAULT_VALUES: Record<string, number> = {
  avg_deal_size: 25000,
  mql_to_opportunity_rate: 0.15,
  opportunity_to_close_rate: 0.25,
  meeting_to_opportunity_rate: 0.35,
  lead_response_decay_factor: 0.1,
  payment_recovery_rate: 0.6,
  avg_subscription_mrr: 500,
  avg_ltv_multiplier: 24,
  loaded_labor_cost_per_hour: 75,
  duplicate_cleanup_minutes_per_record: 15,
  critical_surface_revenue_share: 0.2,
};

export async function assembleImpactInputs(
  supabase: SupabaseClient,
  params: { orgId: string; issueId?: string | null; findingId?: string | null }
): Promise<AssembledInputs | null> {
  const { orgId, issueId, findingId } = params;
  let detectorKey: string | null = null;
  let evidenceBundle: Record<string, unknown> = {};

  if (findingId) {
    const { data: finding } = await getDetectorFindingById(supabase, findingId);
    if (finding) {
      evidenceBundle = (finding.evidence_bundle_json ?? {}) as Record<string, unknown>;
      const { getDetectorDefinitionById } = await import("@/modules/detection/persistence/detector-definitions.repository");
      const { data: def } = await getDetectorDefinitionById(supabase, finding.detector_definition_id);
      detectorKey = def?.detector_key ?? null;
    }
  }
  if (issueId && !evidenceBundle.headline) {
    const { issue } = await getIssueDetail(supabase, issueId);
    if (issue?.source_type === "detector" && issue.source_ref) {
      const { data: finding } = await getDetectorFindingById(supabase, issue.source_ref);
      if (finding) {
        evidenceBundle = (finding.evidence_bundle_json ?? {}) as Record<string, unknown>;
        const { getDetectorDefinitionById } = await import("@/modules/detection/persistence/detector-definitions.repository");
        const { data: def } = await getDetectorDefinitionById(supabase, finding.detector_definition_id);
        detectorKey = def?.detector_key ?? null;
      }
    }
  }

  const orgAssumptions = await getEffectiveAssumptions(supabase, orgId, [...DEFAULT_ASSUMPTION_KEYS]);
  const assumptions: Record<string, number | string | boolean> = { ...DEFAULT_VALUES };
  for (const [k, v] of Object.entries(orgAssumptions)) {
    assumptions[k] = v;
  }

  const signalRefs = (evidenceBundle.signal_references ?? []) as Array<{ signalId: string }>;
  const signals: AssembledInputs["signals"] = [];
  if (signalRefs.length > 0) {
    for (const ref of signalRefs.slice(0, 10)) {
      const { data: sig } = await import("@/modules/signals/persistence/normalized-signals.repository").then((m) =>
        m.getNormalizedSignalById(supabase, ref.signalId)
      );
      if (sig) signals.push(sig);
    }
  } else {
    const { data: sigs } = await listNormalizedSignals(supabase, {
      orgId,
      fromTime: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      limit: 20,
    });
    signals.push(...sigs);
  }

  return {
    orgId,
    issueId: issueId ?? null,
    findingId: findingId ?? null,
    detectorKey,
    evidenceBundle,
    signals,
    assumptions,
  };
}
