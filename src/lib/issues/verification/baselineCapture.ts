/**
 * Capture baseline metrics at resolve time — merged into detection_metadata.phase4_baseline.
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
import { canonicalVerificationRuleKey } from "./canonicalRuleKey";

export type Phase4Baseline = {
  rule: string;
  capturedAt: string;
  failedCount?: number;
  failedAmountCents?: number;
  refundRate?: number;
  refundSumCents?: number;
  chargePaidSumCents?: number;
  noFollowCount?: number;
  stalledCount?: number;
  staleCount?: number;
  fallbackFromIssue?: boolean;
};

export async function captureBaselineAtResolve(
  admin: SupabaseClient,
  row: {
    org_id: string;
    detection_type?: string | null;
    affected_count?: number | null;
    revenue_impact_cents?: number | null;
  }
): Promise<{ baselineValue: number | null; phase4_baseline: Phase4Baseline }> {
  const rule = canonicalVerificationRuleKey(row.detection_type ?? null);
  const orgId = row.org_id;
  const now = Date.now();
  const capturedAt = new Date().toISOString();

  try {
    if (rule === "failed_payments") {
      const m = await measureStripeFailedPayments(admin, orgId);
      return {
        baselineValue: m.count,
        phase4_baseline: {
          rule,
          capturedAt,
          failedCount: m.count,
          failedAmountCents: m.amountCents,
        },
      };
    }
    if (rule === "high_refund_rate") {
      const m = await measureStripeRefundRate(admin, orgId);
      return {
        baselineValue: m.refundRate,
        phase4_baseline: {
          rule,
          capturedAt,
          refundRate: m.refundRate,
          refundSumCents: m.refundSumCents,
          chargePaidSumCents: m.chargePaidSumCents,
        },
      };
    }
    if (rule === "no_follow_up") {
      const evs = await fetchHubSpotRaw(admin, orgId);
      const n = countNoFollowUpLeads(evs, now);
      return {
        baselineValue: n,
        phase4_baseline: { rule, capturedAt, noFollowCount: n },
      };
    }
    if (rule === "stalled_deals") {
      const evs = await fetchHubSpotRaw(admin, orgId);
      const n = countStalledDeals(evs, now);
      return {
        baselineValue: n,
        phase4_baseline: { rule, capturedAt, stalledCount: n },
      };
    }
    if (rule === "stale_opportunities") {
      const evs = await fetchSalesforceRaw(admin, orgId);
      const n = countStaleOpportunities(evs, now);
      return {
        baselineValue: n,
        phase4_baseline: { rule, capturedAt, staleCount: n },
      };
    }
  } catch {
    // fallback below
  }

  return {
    baselineValue: row.affected_count != null ? Number(row.affected_count) : null,
    phase4_baseline: {
      rule: rule ?? "unknown",
      capturedAt,
      fallbackFromIssue: true,
      failedCount: row.affected_count ?? 0,
      failedAmountCents: row.revenue_impact_cents ?? 0,
    },
  };
}
