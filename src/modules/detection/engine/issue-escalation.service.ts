/**
 * Phase 4 — Issue creation contract (§11).
 * Detectors call this service to create issues from actionable findings.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { createIssueFromSource } from "@/modules/issues";
import type { CreateIssueInput } from "@/modules/issues/domain";

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
};

export type IssueEscalationResult =
  | { ok: true; issueId: string; created: boolean }
  | { ok: false; error: string };

/**
 * Create or link issue from detector finding. Applies dedupe via source_ref (findingId).
 */
export async function escalateFindingToIssue(
  supabase: SupabaseClient,
  payload: DetectorIssuePayload
): Promise<IssueEscalationResult> {
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
  };

  const { issue, error } = await createIssueFromSource(supabase, input);
  if (error) return { ok: false, error };
  if (!issue) return { ok: false, error: "Insert did not return issue" };

  // TODO: Attach evidence to issue_sources, link entities via issue_entities
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
