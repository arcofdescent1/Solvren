/**
 * Phase 4 — Issue creation contract (§11).
 * Phase 1 Gap 1 — Full linkage: signals, entities, evidence, lineage.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { createIssueFromSource } from "@/modules/issues";
import type { CreateIssueInput } from "@/modules/issues/domain";
import { linkSignals, linkEntities } from "../services/issue-linkage.service";
import { buildEvidenceFromBundle, attachEvidence } from "../services/issue-evidence.service";
import { resolveEntities } from "../services/issue-entity-resolver.service";
import { recordLineage } from "../services/issue-lineage.service";
import { updateIssue } from "@/modules/issues";

export type DetectorIssuePayload = {
  detectorKey: string;
  findingId: string;
  orgId: string;
  title: string;
  summary: string;
  domain: string;
  severity: string;
  priorityBand: string;
  primaryCanonicalEntityId: string | null;
  secondaryEntityIds: string[];
  evidenceBundle: Record<string, unknown>;
  confidenceScore: number;
  impactPrerequisites?: unknown[];
  routingHints?: Record<string, unknown>;
  dedupeFingerprint: string;
  /** Phase 1 Gap 1 — signals that triggered this detection */
  signals?: Array<{ id: string; signal_key?: string; primary_canonical_entity_id?: string | null }>;
};

export type IssueEscalationResult =
  | { ok: true; issueId: string; created: boolean }
  | { ok: false; error: string };

/**
 * Create or link issue from detector finding. Applies dedupe via source_ref (findingId).
 * Completes linkage: signals, entities, evidence, lineage.
 */
export async function escalateFindingToIssue(
  supabase: SupabaseClient,
  payload: DetectorIssuePayload
): Promise<IssueEscalationResult> {
  const signalsWithKey = (payload.signals ?? []).filter(
    (s): s is { id: string; signal_key: string; primary_canonical_entity_id?: string | null } =>
      typeof s.signal_key === "string"
  );
  const entitiesResult = resolveEntities({
    signals: signalsWithKey,
    extractedEntities: (payload.evidenceBundle.entities as Array<{ entityType: string; entityId?: string; displayName?: string }>) ?? [],
    primaryCanonicalEntityId: payload.primaryCanonicalEntityId,
    secondaryEntityIds: payload.secondaryEntityIds,
  });

  const primaryEntity = entitiesResult.entities.find((e) => e.role === "primary");
  const issueConfidence = entitiesResult.missingPrimaryEntity
    ? Math.min(payload.confidenceScore * 0.5, 0.5)
    : payload.confidenceScore;

  const input: CreateIssueInput = {
    org_id: payload.orgId,
    source_type: "detector",
    source_ref: payload.findingId,
    domain_key: payload.domain,
    title: payload.title,
    summary: payload.summary,
    description: formatEvidenceForDescription(payload.evidenceBundle),
    severity: mapSeverity(payload.severity),
    confidence_score: payload.confidenceScore,
    created_by: null,
    detector_key: payload.detectorKey,
    primary_entity_id: primaryEntity?.entityId ?? null,
    issue_type: "detector",
    issue_subtype: payload.detectorKey,
    issue_confidence: issueConfidence,
  };

  const { issue, error } = await createIssueFromSource(supabase, input);
  if (error) return { ok: false, error };
  if (!issue) return { ok: false, error: "Insert did not return issue" };

  if (entitiesResult.missingPrimaryEntity) {
    await updateIssue(supabase, issue.id, { confidence_score: issueConfidence });
  }

  await supabase.from("issue_sources").insert({
    issue_id: issue.id,
    source_type: "detector",
    source_ref: payload.findingId,
    evidence_json: payload.evidenceBundle,
  });

  const primarySignalIds = new Set(
    (payload.evidenceBundle.signal_references as Array<{ signalId: string }>)?.map((r) => r.signalId) ?? []
  );
  const allSignalIds = new Set((payload.signals ?? []).map((s) => s.id));
  const signalLinks = Array.from(allSignalIds).map((signalId) => ({
    signalId,
    relevanceScore: primarySignalIds.has(signalId) ? 1.0 : 0.5,
  }));

  const [linkResult, entityResult, evidenceResult, lineageResult] = await Promise.all([
    linkSignals(supabase, issue.id, signalLinks),
    linkEntities(supabase, issue.id, entitiesResult.entities),
    attachEvidence(supabase, issue.id, buildEvidenceFromBundle(payload.evidenceBundle)),
    recordLineage(supabase, issue.id, payload.detectorKey, {
      signalIds: signalLinks.map((s) => s.signalId),
      ruleKey: "detector_finding",
      evidenceBundle: payload.evidenceBundle,
    }),
  ]);

  if (linkResult.errors.length) console.warn("[escalation] Signal link errors:", linkResult.errors);
  if (entityResult.errors.length) console.warn("[escalation] Entity link errors:", entityResult.errors);
  if (evidenceResult.errors.length) console.warn("[escalation] Evidence errors:", evidenceResult.errors);
  if (lineageResult.errors.length) console.warn("[escalation] Lineage errors:", lineageResult.errors);

  if (entityResult.linked === 0 && entitiesResult.missingPrimaryEntity) {
    console.warn("[escalation] Issue created without primary entity:", issue.id, entitiesResult.reasonCode);
  }

  return { ok: true, issueId: issue.id, created: true };
}

function formatEvidenceForDescription(bundle: Record<string, unknown>): string {
  const headline = bundle.headline as string | undefined;
  const reason = bundle.detector_reason as string | undefined;
  const whyNow = bundle.why_now as string | undefined;
  const parts = [headline, reason, whyNow].filter(Boolean);
  return parts.join("\n\n") || "Detector finding.";
}

function mapSeverity(s: string): "low" | "medium" | "high" | "critical" {
  const v = s.toLowerCase();
  if (v === "critical" || v === "high" || v === "medium" || v === "low") return v;
  return "medium";
}
