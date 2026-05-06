/**
 * Phase 2/3 — Value Engine detections → public.issues (single source of truth).
 * Recurrence: re-detecting a resolved/dismissed/verified issue reopens and increments recurrence_count.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { logProductEventAsync } from "@/lib/telemetry/productEvents";
import { revalidateExecutiveCache } from "@/lib/executive/executivePhase5Cache";
import { RECOMMENDED_ACTIONS } from "@/lib/value-engine/recommendedActions";
import { defaultApprovalStateForNewIssue, defaultSlaDueAtFromSeverity } from "./issueStateService";
import { scoreIssue } from "./issueIntelligenceService";
import { enqueuePhase4IssueNotification } from "./verification/phase4Notifications";

export type DetectionIssueUpsert = {
  orgId: string;
  issueKey: string;
  source: string;
  type: string;
  title: string;
  description: string;
  severity: "low" | "medium" | "high";
  revenueImpactCents: number;
  currency?: string;
  affectedCount: number;
  confidence: "high" | "medium" | "low";
  metadata: Record<string, unknown>;
  /** True when HubSpot/Salesforce used fallback avg deal (not Stripe). */
  revenueImpactFallback?: boolean;
};

function capMeta(meta: Record<string, unknown>): Record<string, unknown> {
  const sample = meta.sampleRecords;
  if (!Array.isArray(sample)) return meta;
  return { ...meta, sampleRecords: sample.slice(0, 10) };
}

export async function upsertDetectionIssue(
  supabase: SupabaseClient,
  row: DetectionIssueUpsert
): Promise<{ ok: true; issueId: string } | { ok: false; error: string }> {
  const recommended =
    RECOMMENDED_ACTIONS[row.type] ??
    "Review this finding in the source system and take corrective action.";

  const now = new Date().toISOString();
  const meta: Record<string, unknown> = {
    ...capMeta(row.metadata),
    revenueImpactFallback: row.revenueImpactFallback === true,
  };

  const { data: existing, error: exErr } = await supabase
    .from("issues")
    .select(
      "id, status, approval_state, recurrence_count, last_recurred_at, issue_key, org_id, verification_status, regression_count, regression_detected"
    )
    .eq("org_id", row.orgId)
    .eq("issue_key", row.issueKey)
    .maybeSingle();

  if (exErr) return { ok: false, error: exErr.message };

  const approval = defaultApprovalStateForNewIssue({
    severity: row.severity,
    revenueImpactCents: row.revenueImpactCents,
  });
  const slaDue = defaultSlaDueAtFromSeverity(row.severity);
  const domainKey = `detection:${row.issueKey}`;

  if (!existing) {
    const insertRow = {
      org_id: row.orgId,
      issue_key: row.issueKey,
      source_type: "detector" as const,
      source_ref: row.type,
      source_event_time: now,
      domain_key: domainKey,
      title: row.title,
      description: row.description,
      severity: row.severity,
      status: "detected" as const,
      verification_status: "not_required" as const,
      revenue_impact_cents: Math.round(row.revenueImpactCents),
      currency: row.currency ?? "usd",
      affected_count: Math.max(0, row.affectedCount),
      detection_metadata: meta,
      detection_confidence: row.confidence,
      detection_source: row.source,
      detection_type: row.type,
      recommended_action: recommended,
      approval_state: approval,
      notification_state: "not_notified",
      sla_due_at: slaDue.toISOString(),
      opened_at: now,
      updated_at: now,
    };

    const { data: ins, error: insErr } = await supabase
      .from("issues")
      .insert(insertRow)
      .select("id")
      .single();
    if (insErr || !ins) return { ok: false, error: insErr?.message ?? "insert failed" };
    const issueId = (ins as { id: string }).id;
    await postPersistMetrics(supabase, row.orgId, now);
    await scoreIssue(supabase, issueId);
    logProductEventAsync(supabase, {
      event: "issue_created",
      orgId: row.orgId,
      issueId,
      entityType: "issue",
      entityId: issueId,
      metadata: { detection_type: row.type },
    });
    revalidateExecutiveCache(row.orgId);
    return { ok: true, issueId };
  }

  const ex = existing as {
    id: string;
    status: string;
    approval_state: string;
    recurrence_count: number | null;
    last_recurred_at: string | null;
    verification_status?: string | null;
    regression_count?: number | null;
    regression_detected?: boolean | null;
  };
  const st = String(ex.status ?? "");
  let nextStatus = st;
  let recurrenceAdd = 0;
  let lastRecurred: string | null = ex.last_recurred_at;

  if (st === "resolved" || st === "verified" || st === "dismissed") {
    recurrenceAdd = 1;
    lastRecurred = now;
    nextStatus = "reopened";
  }

  let nextApproval = String(ex.approval_state ?? "not_required");
  if (recurrenceAdd > 0) {
    nextApproval = defaultApprovalStateForNewIssue({
      severity: row.severity,
      revenueImpactCents: row.revenueImpactCents,
    });
  }

  const isRegression =
    recurrenceAdd > 0 && String(ex.verification_status ?? "") === "passed";

  const updateRow: Record<string, unknown> = {
    title: row.title,
    description: row.description,
    severity: row.severity,
    revenue_impact_cents: Math.round(row.revenueImpactCents),
    currency: row.currency ?? "usd",
    affected_count: Math.max(0, row.affectedCount),
    detection_metadata: meta,
    detection_confidence: row.confidence,
    detection_source: row.source,
    detection_type: row.type,
    recommended_action: recommended,
    source_event_time: now,
    domain_key: domainKey,
    status: nextStatus,
    approval_state: nextApproval,
    sla_due_at: slaDue.toISOString(),
    recurrence_count: (ex.recurrence_count ?? 0) + recurrenceAdd,
    last_recurred_at: lastRecurred,
    updated_at: now,
  };

  if (isRegression) {
    updateRow.regression_detected = true;
    updateRow.regression_count = (ex.regression_count ?? 0) + 1;
    updateRow.verification_status = "failed";
    updateRow.resolved_at = null;
    updateRow.verified_at = null;
  }

  const { error: upErr } = await supabase.from("issues").update(updateRow).eq("id", ex.id);

  if (upErr) return { ok: false, error: upErr.message };
  if (recurrenceAdd > 0) {
    logProductEventAsync(supabase, {
      event: "issue_updated",
      orgId: row.orgId,
      issueId: ex.id,
      metadata: { reason: "recurrence_reopen", issue_key: row.issueKey },
    });
  }
  if (isRegression) {
    logProductEventAsync(supabase, {
      event: "regression_detected",
      orgId: row.orgId,
      issueId: ex.id,
      metadata: { issue_key: row.issueKey },
    });
    await enqueuePhase4IssueNotification(supabase, {
      orgId: row.orgId,
      issueId: ex.id,
      kind: "regression_detected",
      payload: {
        title: row.title,
        revenueImpactCents: Math.round(row.revenueImpactCents),
      },
    });
  }
  await scoreIssue(supabase, ex.id);
  revalidateExecutiveCache(row.orgId);
  return { ok: true, issueId: ex.id };
}

async function postPersistMetrics(
  supabase: SupabaseClient,
  orgId: string,
  now: string
): Promise<void> {
  const { data: metrics } = await supabase
    .from("value_engine_org_metrics")
    .select("first_issue_at")
    .eq("org_id", orgId)
    .maybeSingle();

  const firstAt = (metrics as { first_issue_at?: string } | null)?.first_issue_at;
  if (!firstAt) {
    await supabase.from("value_engine_org_metrics").upsert(
      { org_id: orgId, first_issue_at: now, updated_at: now },
      { onConflict: "org_id" }
    );
  }
}
