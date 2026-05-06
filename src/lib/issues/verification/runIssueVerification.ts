/**
 * Phase 4 — run verification for one issue; update issue, insert events, ROI, notify.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { measureStripeFailedPayments } from "@/lib/value-engine/metrics/stripeFailedPayments";
import { measureStripeRefundRate } from "@/lib/value-engine/metrics/stripeRefundRate";
import {
  countNoFollowUpLeads,
  countStalledDeals,
  fetchHubSpotRaw,
} from "@/lib/value-engine/metrics/hubspotVerificationMetrics";
import {
  countStaleOpportunities,
  fetchSalesforceRaw,
} from "@/lib/value-engine/metrics/salesforceVerificationMetrics";
import { fillRoiTemplate } from "./roiTemplates";
import { canonicalVerificationRuleKey } from "./canonicalRuleKey";
import { enqueuePhase4IssueNotification } from "./phase4Notifications";
import { logProductEventAsync } from "@/lib/telemetry/productEvents";
import { revalidateExecutiveCache } from "@/lib/executive/executivePhase5Cache";
import { retryWithBackoff, RETRY_PRESETS } from "@/lib/retry/retryWithBackoff";
import type { Phase4Baseline } from "./baselineCapture";

const VERIFICATION_WINDOW_MS = 3 * 24 * 60 * 60 * 1000;

export type VerificationOutcome = "passed" | "failed" | "inconclusive";

function meta(row: Record<string, unknown>) {
  return (row.detection_metadata as Record<string, unknown> | null) ?? {};
}

function readPhase4Baseline(row: Record<string, unknown>): Phase4Baseline | null {
  const m = meta(row);
  const b = m.phase4_baseline as Phase4Baseline | undefined;
  return b ?? null;
}

export async function runIssueVerification(
  admin: SupabaseClient,
  issueId: string
): Promise<{ ok: true; outcome: VerificationOutcome } | { ok: false; error: string }> {
  const { data: row, error: le } = await admin.from("issues").select("*").eq("id", issueId).maybeSingle();
  if (le || !row) return { ok: false, error: le?.message ?? "not found" };

  const r = row as Record<string, unknown>;
  const orgId = r.org_id as string;

  if (String(r.status ?? "") !== "resolved") return { ok: false, error: "not resolved" };
  if (String(r.verification_status ?? "") !== "pending") return { ok: false, error: "not pending" };

  const resolvedAt = r.resolved_at ? Date.parse(String(r.resolved_at)) : NaN;
  if (!Number.isFinite(resolvedAt) || Date.now() < resolvedAt + VERIFICATION_WINDOW_MS) {
    return { ok: false, error: "window not elapsed" };
  }

  const base = readPhase4Baseline(r);
  const rule = canonicalVerificationRuleKey(String(r.detection_type ?? "")) ?? base?.rule ?? "";

  logProductEventAsync(admin, {
    event: "verification_run",
    orgId,
    issueId,
    metadata: { verification_type: rule || "unknown" },
  });
  const now = Date.now();

  let outcome: VerificationOutcome = "inconclusive";
  let postMetric = 0;
  let postAmountCents = 0;
  const baseline = base ?? { rule, capturedAt: "" } as Phase4Baseline;

  try {
    if (rule === "failed_payments") {
      const post = await measureStripeFailedPayments(admin, orgId);
      const bCount = Number(baseline.failedCount ?? r.baseline_value ?? post.count);
      const bAmt = Number(baseline.failedAmountCents ?? r.revenue_impact_cents ?? 0);
      postMetric = post.count;
      postAmountCents = post.amountCents;
      const countOk = post.count < bCount;
      const amountOk = post.amountCents < bAmt;
      if (countOk && amountOk) outcome = "passed";
      else if (countOk !== amountOk) outcome = "inconclusive";
      else outcome = "failed";
    } else if (rule === "high_refund_rate") {
      const post = await measureStripeRefundRate(admin, orgId);
      const bRate = Number(baseline.refundRate ?? r.baseline_value ?? post.refundRate);
      postMetric = post.refundRate;
      postAmountCents = post.refundSumCents;
      if (post.refundRate < bRate) outcome = "passed";
      else outcome = "failed";
    } else if (rule === "no_follow_up") {
      const evs = await fetchHubSpotRaw(admin, orgId);
      const post = countNoFollowUpLeads(evs, now);
      const b = Number(baseline.noFollowCount ?? r.baseline_value ?? post);
      postMetric = post;
      if (post < b) outcome = "passed";
      else outcome = "failed";
    } else if (rule === "stalled_deals") {
      const evs = await fetchHubSpotRaw(admin, orgId);
      const post = countStalledDeals(evs, now);
      const b = Number(baseline.stalledCount ?? r.baseline_value ?? post);
      postMetric = post;
      if (post < b) outcome = "passed";
      else outcome = "failed";
    } else if (rule === "stale_opportunities") {
      const evs = await fetchSalesforceRaw(admin, orgId);
      const post = countStaleOpportunities(evs, now);
      const b = Number(baseline.staleCount ?? r.baseline_value ?? post);
      postMetric = post;
      if (post < b) outcome = "passed";
      else outcome = "failed";
    } else {
      outcome = "inconclusive";
    }
  } catch {
    outcome = "inconclusive";
  }

  const m = meta(r);
  const estimated = Number(r.revenue_impact_cents ?? 0) || 0;
  const avgDealUsd = Number(m.avgDealValue ?? NaN);
  const conv = Number(m.conversionRate ?? NaN);

  let finalOutcome = outcome;
  let actualRoi: number | null = null;
  let roiConf: "low" | "medium" | "high" = "medium";
  const roiType: "recovered_revenue" | "prevented_loss" | "efficiency_gain" = "recovered_revenue";
  let explanation = "";

  if (finalOutcome === "passed") {
    if (rule === "failed_payments") {
      const bAmt = Number(baseline.failedAmountCents ?? 0);
      actualRoi = Math.max(0, bAmt - postAmountCents);
      roiConf = "high";
    } else if (rule === "high_refund_rate") {
      const bSum = Number(baseline.refundSumCents ?? 0);
      actualRoi = Math.max(0, bSum - postAmountCents);
      roiConf = "high";
    } else if (rule === "no_follow_up") {
      if (!Number.isFinite(avgDealUsd) || !Number.isFinite(conv)) {
        finalOutcome = "inconclusive";
      } else {
        const bCount = Number(baseline.noFollowCount ?? 0);
        const delta = bCount - postMetric;
        actualRoi = Math.round(delta * avgDealUsd * 100 * conv);
        roiConf = "medium";
      }
    } else if (rule === "stalled_deals") {
      if (!Number.isFinite(avgDealUsd) || !Number.isFinite(conv)) {
        finalOutcome = "inconclusive";
      } else {
        const bCount = Number(baseline.stalledCount ?? 0);
        const delta = bCount - postMetric;
        actualRoi = Math.round(delta * avgDealUsd * 100 * conv);
        roiConf = "medium";
      }
    } else if (rule === "stale_opportunities") {
      if (!Number.isFinite(avgDealUsd)) {
        finalOutcome = "inconclusive";
      } else {
        const bCount = Number(baseline.staleCount ?? 0);
        const delta = bCount - postMetric;
        actualRoi = Math.round(delta * avgDealUsd * 100);
        roiConf = "medium";
      }
    }
  }

  const title = String(r.title ?? "Issue");

  if (finalOutcome === "passed" && actualRoi != null) {
    explanation = fillRoiTemplate("recovered_revenue", {
      amount: `$${(actualRoi / 100).toFixed(0)}`,
      title,
      detail:
        rule === "failed_payments"
          ? `Failed payment exposure reduced (count ${baseline.failedCount ?? "—"} → ${postMetric}).`
          : `Metric improved vs baseline.`,
    });
  }

  const vs: "passed" | "failed" | "inconclusive" =
    finalOutcome === "passed" ? "passed" : finalOutcome === "failed" ? "failed" : "inconclusive";

  const evidence = {
    phase4_baseline: baseline,
    post: { postMetric, postAmountCents, rule, measuredAt: new Date().toISOString() },
  };

  await admin.from("issue_verification_events").insert({
    org_id: orgId,
    issue_id: issueId,
    verification_type: rule || "unknown",
    result: vs,
    baseline_value: Number(r.baseline_value ?? baseline.failedCount ?? baseline.noFollowCount ?? 0) || null,
    measured_value: postMetric,
    evidence,
  });

  const patch: Record<string, unknown> = {
    verification_status: vs,
    post_fix_value: postMetric,
    updated_at: new Date().toISOString(),
  };

  if (vs === "passed" && actualRoi != null) {
    patch.status = "verified";
    patch.verified_at = new Date().toISOString();
    patch.actual_roi_cents = actualRoi;
    patch.roi_confidence = roiConf;
  }

  await admin.from("issues").update(patch).eq("id", issueId);

  if (vs === "passed" && actualRoi != null) {
    await admin.from("roi_events").insert({
      org_id: orgId,
      issue_id: issueId,
      roi_type: roiType,
      estimated_value_cents: estimated,
      actual_value_cents: actualRoi,
      confidence: roiConf,
      explanation,
    });

    logProductEventAsync(admin, {
      event: "roi_generated",
      orgId,
      issueId,
      metadata: { actual_roi_cents: actualRoi, estimated_value_cents: estimated },
    });
    revalidateExecutiveCache(orgId);

    await enqueuePhase4IssueNotification(admin, {
      orgId,
      issueId,
      kind: "roi_generated",
      payload: {
        title,
        actualRoiCents: actualRoi,
        confidence: roiConf,
      },
    });
  }

  logProductEventAsync(admin, {
    event: "issue_verified",
    orgId,
    issueId,
    metadata: { outcome: vs, verification_type: rule },
  });
  revalidateExecutiveCache(orgId);

  await enqueuePhase4IssueNotification(admin, {
    orgId,
    issueId,
    kind: "issue_verified",
    payload: { outcome: vs, title },
  });

  return { ok: true, outcome: vs };
}

export async function runVerificationForEligibleIssues(
  admin: SupabaseClient
): Promise<{ processed: number; errors: number }> {
  const cutoff = new Date(Date.now() - VERIFICATION_WINDOW_MS).toISOString();

  const { data: rows, error } = await admin
    .from("issues")
    .select("id")
    .eq("status", "resolved")
    .eq("verification_status", "pending")
    .not("resolved_at", "is", null)
    .lte("resolved_at", cutoff)
    .limit(100);

  if (error) return { processed: 0, errors: 1 };

  let processed = 0;
  let errors = 0;
  for (const row of rows ?? []) {
    try {
      await retryWithBackoff(
        async () => {
          const r = await runIssueVerification(admin, (row as { id: string }).id);
          if (!r.ok) throw new Error(r.error);
          return r;
        },
        RETRY_PRESETS.verificationRunner
      );
      processed += 1;
    } catch {
      errors += 1;
    }
  }
  return { processed, errors };
}
