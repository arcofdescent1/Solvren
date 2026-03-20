/**
 * Phase 1 Gap 1 — Issue evidence service (§8).
 * Attaches structured evidence to issues.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export type EvidenceItem = {
  evidenceType: "raw_signal" | "computed_metric" | "rule_match" | "aggregation";
  evidenceKey: string;
  payload: Record<string, unknown>;
  confidence?: number;
};

const MAX_PAYLOAD_BYTES = 256 * 1024;

export function buildEvidenceFromBundle(bundle: Record<string, unknown>): EvidenceItem[] {
  const items: EvidenceItem[] = [];

  const headline = bundle.headline as string | undefined;
  const detectorReason = bundle.detector_reason as string | undefined;
  if (headline || detectorReason) {
    items.push({
      evidenceType: "rule_match",
      evidenceKey: "detector_finding",
      payload: { headline, detector_reason: detectorReason, why_now: bundle.why_now },
      confidence: 1.0,
    });
  }

  const thresholdsCrossed = (bundle.thresholds_crossed as Array<{ threshold: string; value: unknown; limit?: unknown }>) ?? [];
  for (const t of thresholdsCrossed) {
    items.push({
      evidenceType: "rule_match",
      evidenceKey: `${t.threshold}_exceeded`,
      payload: { threshold: t.threshold, actual: t.value, limit: t.limit },
      confidence: 1.0,
    });
  }

  const signalRefs = (bundle.signal_references as Array<{ signalId: string; signalKey: string; signalTime: string }>) ?? [];
  for (const sr of signalRefs) {
    items.push({
      evidenceType: "raw_signal",
      evidenceKey: `signal_${sr.signalId}`,
      payload: { signalId: sr.signalId, signalKey: sr.signalKey, signalTime: sr.signalTime },
      confidence: 1.0,
    });
  }

  const timeline = (bundle.timeline as Array<{ event: string; timestamp: string; detail?: string }>) ?? [];
  if (timeline.length > 0) {
    items.push({
      evidenceType: "aggregation",
      evidenceKey: "timeline",
      payload: { events: timeline },
      confidence: 0.9,
    });
  }

  const supportingMetrics = (bundle.supporting_metrics as Record<string, unknown>) ?? {};
  if (Object.keys(supportingMetrics).length > 0) {
    items.push({
      evidenceType: "computed_metric",
      evidenceKey: "supporting_metrics",
      payload: supportingMetrics,
      confidence: 0.8,
    });
  }

  return items;
}

function truncatePayload(payload: Record<string, unknown>): Record<string, unknown> {
  const str = JSON.stringify(payload);
  if (new TextEncoder().encode(str).length <= MAX_PAYLOAD_BYTES) return payload;
  return { _truncated: true, _original_keys: Object.keys(payload), _message: "Payload exceeded size limit" };
}

export async function attachEvidence(
  supabase: SupabaseClient,
  issueId: string,
  evidence: EvidenceItem[]
): Promise<{ attached: number; errors: string[] }> {
  const errors: string[] = [];
  let attached = 0;

  for (const e of evidence) {
    const payload = truncatePayload(e.payload);
    const { error } = await supabase.from("issue_evidence").insert({
      issue_id: issueId,
      evidence_type: e.evidenceType,
      evidence_key: e.evidenceKey,
      payload_json: payload,
      confidence: e.confidence ?? null,
    });
    if (error) {
      errors.push(`${e.evidenceKey}: ${error.message}`);
    } else {
      attached++;
    }
  }

  return { attached, errors };
}
