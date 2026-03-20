/**
 * Phase 4 — Detector runner (§8).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { getDetector } from "../registry/detector-registry";
import { getDetectorDefinitionByKey } from "../persistence/detector-definitions.repository";
import { getDetectorConfig } from "../persistence/detector-configs.repository";
import { insertDetectorRun, updateDetectorRun } from "../persistence/detector-runs.repository";
import { insertDetectorFinding, updateDetectorFinding } from "../persistence/detector-findings.repository";
import { checkSuppression } from "./suppression-engine.service";
import { escalateFindingToIssue } from "./issue-escalation.service";

export type RunDetectorInput = {
  orgId: string;
  detectorKey: string;
  signals: Array<{
    id: string;
    signal_key: string;
    signal_time: string;
    primary_canonical_entity_id: string | null;
    dimensions_json: Record<string, unknown>;
    measures_json: Record<string, unknown>;
    references_json: Record<string, unknown>;
    source_ref: string | null;
  }>;
  triggerSignalId?: string | null;
  windowStart?: string | null;
  windowEnd?: string | null;
};

export type RunDetectorResult = {
  ok: boolean;
  runId?: string;
  candidateCount: number;
  detectionCount: number;
  suppressedCount: number;
  errorCount: number;
  findings: Array<{ id: string; status: string }>;
};

export async function runDetector(
  supabase: SupabaseClient,
  input: RunDetectorInput
): Promise<RunDetectorResult> {
  const { data: def, error: defErr } = await getDetectorDefinitionByKey(supabase, input.detectorKey);
  if (defErr || !def) {
    return { ok: false, candidateCount: 0, detectionCount: 0, suppressedCount: 0, errorCount: 1, findings: [] };
  }

  const { data: config } = await getDetectorConfig(supabase, input.orgId, def.id);
  if (!config?.enabled) {
    return { ok: false, candidateCount: 0, detectionCount: 0, suppressedCount: 0, errorCount: 0, findings: [] };
  }

  const { data: run, error: runErr } = await insertDetectorRun(supabase, {
    org_id: input.orgId,
    detector_definition_id: def.id,
    run_mode: input.triggerSignalId ? "event_driven" : "scheduled",
    trigger_signal_id: input.triggerSignalId ?? null,
    window_start: input.windowStart ?? null,
    window_end: input.windowEnd ?? null,
    status: "running",
    candidate_count: 0,
    detection_count: 0,
    suppressed_count: 0,
    error_count: 0,
    metrics_json: {},
    started_at: new Date().toISOString(),
    completed_at: null,
  });
  if (runErr || !run) {
    return { ok: false, candidateCount: 0, detectionCount: 0, suppressedCount: 0, errorCount: 1, findings: [] };
  }

  const detector = getDetector(input.detectorKey);
  let candidateCount = 0;
  let detectionCount = 0;
  let suppressedCount = 0;
  let errorCount = 0;
  const findings: Array<{ id: string; status: string }> = [];

  if (detector) {
    try {
      const ctx = {
        orgId: input.orgId,
        detectorDefinition: def,
        detectorConfig: config,
        signals: input.signals as never[],
        triggerSignalId: input.triggerSignalId ?? null,
        windowStart: input.windowStart ?? null,
        windowEnd: input.windowEnd ?? null,
      };
      const result = await detector.evaluate(ctx);

      if (result.conditionsMatched) {
        candidateCount++;
        const findingStatus = result.suppressionReasons?.length
          ? "suppressed"
          : "actionable";

        if (findingStatus === "suppressed") suppressedCount++;
        else detectionCount++;

        const suppression = await checkSuppression(supabase, {
          orgId: input.orgId,
          detectorDefinitionId: def.id,
          dedupeKey: result.dedupeKey,
          groupingKey: result.groupingKey,
          rolloutState: config.rollout_state,
        });

        const effectiveStatus = suppression.suppressed ? "suppressed" : findingStatus;
        if (suppression.suppressed) suppressedCount = Math.max(suppressedCount, suppressedCount);

        const { data: finding } = await insertDetectorFinding(supabase, {
          org_id: input.orgId,
          detector_definition_id: def.id,
          detector_run_id: run.id,
          grouping_key: result.groupingKey,
          dedupe_key: result.dedupeKey,
          finding_status: effectiveStatus,
          primary_canonical_entity_id: null,
          severity: def.default_severity,
          priority_band: def.default_priority_band,
          confidence_score: result.confidenceScore,
          evidence_bundle_json: result.evidenceBundle as Record<string, unknown>,
          suppression_reason_json: result.suppressionReasons
            ? { reasons: result.suppressionReasons }
            : null,
          issue_id: null,
        });

        if (finding) findings.push({ id: finding.id, status: effectiveStatus });

        if (effectiveStatus === "actionable" && !suppression.suppressed) {
          const escalateResult = await escalateFindingToIssue(supabase, {
            detectorKey: input.detectorKey,
            findingId: finding!.id,
            orgId: input.orgId,
            title: (result.evidenceBundle as { headline?: string }).headline ?? "Detector finding",
            summary: (result.evidenceBundle as { detector_reason?: string }).detector_reason ?? "",
            domain: "revenue",
            severity: result.severityOverride ?? def.default_severity,
            priorityBand: def.default_priority_band,
            primaryCanonicalEntityId: null,
            secondaryEntityIds: [],
            evidenceBundle: result.evidenceBundle as Record<string, unknown>,
            confidenceScore: result.confidenceScore,
            dedupeFingerprint: result.proposedIssueFingerprint,
          });
          if (escalateResult.ok) {
            await updateDetectorFinding(supabase, finding!.id, {
              finding_status: "issue_created",
              issue_id: escalateResult.issueId,
            });
            const { applyRoutingRules } = await import("@/modules/execution");
            const { updateIssue } = await import("@/modules/issues");
            const routing = await applyRoutingRules(supabase, {
              orgId: input.orgId,
              issueId: escalateResult.issueId,
              domainKey: "revenue",
              sourceType: "detector",
              severity: result.severityOverride ?? def.default_severity,
            });
            if (routing.ownerType === "user" && routing.ownerRef) {
              await updateIssue(supabase, escalateResult.issueId, { owner_user_id: routing.ownerRef });
            } else if (routing.ownerType === "team" && routing.ownerRef) {
              await updateIssue(supabase, escalateResult.issueId, { owner_team_key: routing.ownerRef });
            }
            const { assessImpact } = await import("@/modules/impact/engine/impact-engine.service");
            assessImpact(supabase, {
              orgId: input.orgId,
              issueId: escalateResult.issueId,
              findingId: finding!.id,
              detectorKey: input.detectorKey,
            }).catch((err) => console.error("[impact] Assess failed:", err));
          }
        }
      }
    } catch (e) {
      errorCount++;
    }
  } else {
    errorCount++;
  }

  await updateDetectorRun(supabase, run.id, {
    status: "completed",
    candidate_count: candidateCount,
    detection_count: detectionCount,
    suppressed_count: suppressedCount,
    error_count: errorCount,
    completed_at: new Date().toISOString(),
  });

  return {
    ok: true,
    runId: run.id,
    candidateCount,
    detectionCount,
    suppressedCount,
    errorCount,
    findings,
  };
}
