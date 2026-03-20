/**
 * Phase 1 Gap 1 — Issue lineage service (§10).
 * Records signal → detector → issue lineage for auditability.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export type LineageEntry = {
  sourceType: "signal" | "detector" | "rule" | "aggregation";
  sourceRef: string;
  metadata?: Record<string, unknown>;
};

export async function recordLineage(
  supabase: SupabaseClient,
  issueId: string,
  detectorKey: string,
  detectionContext: {
    signalIds?: string[];
    ruleKey?: string;
    aggregationIds?: string[];
    evidenceBundle?: Record<string, unknown>;
  }
): Promise<{ recorded: number; errors: string[] }> {
  const entries: LineageEntry[] = [];
  const errors: string[] = [];

  entries.push({
    sourceType: "detector",
    sourceRef: detectorKey,
    metadata: {
      rule: detectionContext.ruleKey ?? null,
      signal_count: detectionContext.signalIds?.length ?? 0,
    },
  });

  if (detectionContext.ruleKey) {
    entries.push({
      sourceType: "rule",
      sourceRef: detectionContext.ruleKey,
      metadata: {},
    });
  }

  for (const sigId of detectionContext.signalIds ?? []) {
    entries.push({
      sourceType: "signal",
      sourceRef: sigId,
      metadata: {},
    });
  }

  for (const aggId of detectionContext.aggregationIds ?? []) {
    entries.push({
      sourceType: "aggregation",
      sourceRef: aggId,
      metadata: {},
    });
  }

  let recorded = 0;
  for (const e of entries) {
    const { error } = await supabase.from("issue_lineage").insert({
      issue_id: issueId,
      source_type: e.sourceType,
      source_ref: e.sourceRef,
      metadata_json: e.metadata ?? {},
    });
    if (error) {
      errors.push(`${e.sourceType}:${e.sourceRef}: ${error.message}`);
    } else {
      recorded++;
    }
  }

  return { recorded, errors };
}
