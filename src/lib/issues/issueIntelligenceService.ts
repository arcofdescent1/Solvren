/**
 * Phase 3 — issueIntelligenceService: score, persist, history, groups.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { logProductEventAsync } from "@/lib/telemetry/productEvents";
import { isHighImpact } from "./issueStateService";
import {
  calculateActionabilityScore,
  calculateConfidenceInputScore,
  calculateImpactScore,
  calculateNoiseScore,
  calculateRecurrenceScore,
  calculateUrgencyScore,
  generateIntelligenceSummary,
  isPayloadIncomplete,
  priorityBandFromScore,
  roundedWeightedPriority,
  shouldAutoSuppress,
} from "./issueIntelligenceScoring";

export type ScoredIssueFields = {
  priorityScore: number;
  priorityBand: string;
  confidenceScore: number;
  noiseScore: number;
  priorityReason: Record<string, unknown>;
  intelligenceSummary: string;
};

const ACTIVE_FOR_SCORING = new Set([
  "detected",
  "acknowledged",
  "assigned",
  "in_progress",
  "reopened",
  "open",
  "triaged",
]);

function buildGroupKey(orgId: string, detectionSource: string, detectionType: string): string {
  return `${orgId}:${detectionSource}:${detectionType}`;
}

/** Any dismiss in org for this logical issue_key (Phase 3 noise +15). */
export async function hadHistoricalDismissForIssueKey(
  admin: SupabaseClient,
  orgId: string,
  issueKey: string
): Promise<boolean> {
  if (!issueKey) return false;
  const { data, error } = await admin.rpc("issue_had_dismiss_by_key", {
    p_org_id: orgId,
    p_issue_key: issueKey,
  });
  if (error) {
    console.warn("[issueIntelligence] issue_had_dismiss_by_key failed:", error.message);
    return false;
  }
  return Boolean(data);
}

export function computeScoresForRow(row: Record<string, unknown>, hadDismiss: boolean): ScoredIssueFields {
  const revenue = Number(row.revenue_impact_cents ?? 0) || 0;
  const affected = Number(row.affected_count ?? 0) || 0;
  const meta = (row.detection_metadata as Record<string, unknown> | null) ?? {};
  const fallback = Boolean(meta.revenueImpactFallback === true);
  const detectionConfidence = row.detection_confidence as string | undefined;
  const detectionSource = row.detection_source as string | undefined;
  const detectionType = row.detection_type as string | undefined;
  const recommended = row.recommended_action as string | undefined;
  const ownerEmail = row.owner_email as string | undefined;
  const status = String(row.status ?? "");
  const approvalState = String(row.approval_state ?? "not_required");
  const slaDueAt = (row.sla_due_at as string | null) ?? null;
  const severity = String(row.severity ?? "medium");
  const recurrenceCount = Number(row.recurrence_count ?? 0) || 0;
  const description = row.description as string | null | undefined;

  const impact = calculateImpactScore(revenue);
  const urgency = calculateUrgencyScore({
    status,
    approvalState,
    slaDueAt,
    severity,
    revenueImpactCents: revenue,
  });
  const confInput = calculateConfidenceInputScore({
    detectionConfidence,
    detectionSource,
    affectedCount: affected,
    revenueImpactFallback: fallback,
  });
  const recurrence = calculateRecurrenceScore(recurrenceCount);
  const actionability = calculateActionabilityScore({
    recommendedAction: recommended,
    ownerEmail,
    detectionType,
  });

  const priorityScore = roundedWeightedPriority({
    impact: impact.score,
    urgency: urgency.score,
    confidence: confInput.score,
    recurrence: recurrence.score,
    actionability: actionability.score,
  });
  const priorityBand = priorityBandFromScore(priorityScore);

  const highImpact = isHighImpact({ severity, revenueImpactCents: revenue });
  const { noiseScore } = calculateNoiseScore({
    revenueImpactCents: revenue,
    affectedCount: affected,
    confidenceScore: confInput.score,
    hadDismissAction: hadDismiss,
    payloadIncomplete: isPayloadIncomplete({
      metadata: meta,
      description,
      affectedCount: affected,
    }),
    isHighImpactIssue: highImpact,
  });

  const priorityReason = {
    impact: { score: impact.score, reason: impact.reason },
    urgency: { score: urgency.score, reason: urgency.reason },
    confidence: { score: confInput.score, reason: confInput.reason },
    recurrence: { score: recurrence.score, reason: recurrence.reason },
    actionability: { score: actionability.score, reason: actionability.reason },
  };

  const impactPhrase = impact.reason;
  const urgencyPhrase = urgency.reason.toLowerCase();
  const confidencePhrase = confInput.reason.toLowerCase();

  const intelligenceSummary = generateIntelligenceSummary({
    title: String(row.title ?? "Issue"),
    priorityBand,
    impactPhrase: impactPhrase.toLowerCase(),
    urgencyPhrase,
    confidencePhrase,
  });

  return {
    priorityScore,
    priorityBand,
    confidenceScore: confInput.score,
    noiseScore,
    priorityReason,
    intelligenceSummary,
  };
}

/** Normalize legacy statuses in-row (mutates nothing; returns patch). */
export function legacyStatusNormalizePatch(status: string): Record<string, string> | null {
  if (status === "open") return { status: "detected" };
  if (status === "triaged") return { status: "acknowledged" };
  return null;
}

export async function scoreIssue(admin: SupabaseClient, issueId: string): Promise<{ ok: boolean; error?: string }> {
  const { data: row, error: le } = await admin.from("issues").select("*").eq("id", issueId).maybeSingle();
  if (le || !row) return { ok: false, error: le?.message ?? "not found" };

  const r = row as Record<string, unknown>;
  const st = String(r.status ?? "");

  const legacy = legacyStatusNormalizePatch(st);
  if (legacy) {
    await admin.from("issues").update({ ...legacy, updated_at: new Date().toISOString() }).eq("id", issueId);
    r.status = legacy.status;
  }

  const statusNow = String(r.status ?? "");
  if (!ACTIVE_FOR_SCORING.has(statusNow)) {
    return { ok: true };
  }

  let supUntil = (r.suppressed_until as string | null) ?? null;
  if (supUntil && Date.parse(supUntil) < Date.now()) {
    await admin
      .from("issues")
      .update({
        suppressed_until: null,
        suppression_reason: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", issueId);
    supUntil = null;
    r.suppressed_until = null;
    r.suppression_reason = null;
  }
  const currentlySuppressed = Boolean(supUntil && Date.parse(supUntil) > Date.now());

  const dismiss = await hadHistoricalDismissForIssueKey(
    admin,
    r.org_id as string,
    String(r.issue_key ?? "")
  );
  const computed = computeScoresForRow(r, dismiss);
  const revenue = Number(r.revenue_impact_cents ?? 0) || 0;

  const updatePayload: Record<string, unknown> = {
    priority_score: computed.priorityScore,
    priority_band: computed.priorityBand,
    confidence_score: computed.confidenceScore,
    noise_score: computed.noiseScore,
    priority_reason: computed.priorityReason,
    intelligence_summary: computed.intelligenceSummary,
    updated_at: new Date().toISOString(),
  };

  if (
    shouldAutoSuppress({ noiseScore: computed.noiseScore, revenueImpactCents: revenue }) &&
    !currentlySuppressed
  ) {
    updatePayload.suppressed_until = new Date(Date.now() + 7 * 86400000).toISOString();
    updatePayload.suppression_reason = "Low confidence, low impact, or likely duplicate noise";
  }

  const { error: ue } = await admin.from("issues").update(updatePayload).eq("id", issueId);
  if (ue) return { ok: false, error: ue.message };

  await admin.from("issue_score_history").insert({
    org_id: r.org_id as string,
    issue_id: issueId,
    priority_score: computed.priorityScore,
    priority_band: computed.priorityBand,
    confidence_score: computed.confidenceScore,
    noise_score: computed.noiseScore,
    score_inputs: {
      impact: (computed.priorityReason as { impact?: unknown }).impact,
      urgency: (computed.priorityReason as { urgency?: unknown }).urgency,
    },
    score_reason: computed.priorityReason,
  });

  await updateIssueGroup(admin, issueId, r);

  logProductEventAsync(admin, {
    event: "issue_updated",
    orgId: r.org_id as string,
    issueId,
    metadata: { reason: "score_recalc", priority_score: computed.priorityScore },
  });

  return { ok: true };
}

export async function updateIssueGroup(
  admin: SupabaseClient,
  issueId: string,
  row: Record<string, unknown>
): Promise<void> {
  const orgId = row.org_id as string;
  const src = row.detection_source ? String(row.detection_source) : "";
  const typ = row.detection_type ? String(row.detection_type) : "";
  if (!src || !typ) return;

  const gk = buildGroupKey(orgId, src, typ);
  const title = `${src}:${typ}`;

  const { data: agg } = await admin
    .from("issues")
    .select("id, revenue_impact_cents, priority_score, status")
    .eq("org_id", orgId)
    .eq("detection_source", src)
    .eq("detection_type", typ);

  const rows = (agg ?? []) as Array<{
    id: string;
    revenue_impact_cents: number;
    priority_score: number;
    status: string;
  }>;

  const active = rows.filter((x) =>
    ACTIVE_FOR_SCORING.has(String(x.status ?? "").toLowerCase())
  );
  if (active.length === 0) return;

  let sumImpact = 0;
  let maxPri = 0;
  let primaryId = issueId;
  for (const x of active) {
    sumImpact += Number(x.revenue_impact_cents ?? 0);
    const p = Number(x.priority_score ?? 0);
    if (p > maxPri) {
      maxPri = p;
      primaryId = x.id;
    }
  }

  const now = new Date().toISOString();
  const { data: grp, error } = await admin
    .from("issue_groups")
    .upsert(
      {
        org_id: orgId,
        group_key: gk,
        title,
        description: null,
        primary_issue_id: primaryId,
        issue_count: active.length,
        total_revenue_impact_cents: sumImpact,
        highest_priority_score: maxPri,
        status: "active",
        updated_at: now,
      },
      { onConflict: "org_id,group_key" }
    )
    .select("id")
    .maybeSingle();

  if (error || !grp) return;

  const gid = (grp as { id: string }).id;
  await admin
    .from("issues")
    .update({ related_issue_group_id: gid })
    .eq("org_id", orgId)
    .eq("detection_source", src)
    .eq("detection_type", typ);
}

export async function scoreOrgIssues(admin: SupabaseClient): Promise<{ scored: number; errors: number }> {
  const { data: rows, error } = await admin
    .from("issues")
    .select("id")
    .in("status", Array.from(ACTIVE_FOR_SCORING));

  if (error) return { scored: 0, errors: 1 };

  let scored = 0;
  let errors = 0;
  for (const r of rows ?? []) {
    const res = await scoreIssue(admin, (r as { id: string }).id);
    if (res.ok) scored += 1;
    else errors += 1;
  }
  return { scored, errors };
}
