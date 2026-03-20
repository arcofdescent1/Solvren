/**
 * Phase 4 — Detector A3: Subscription canceled after payment distress (§15.1).
 */
import type { IDetector } from "../base/detector.interface";
import type { DetectorContext } from "../base/detector-context";
import type { DetectionResult } from "../../domain/detection-result";
import { actionableFinding, noFinding } from "../base/detector-result";

const DETECTOR_KEY = "revenue.subscription_canceled_after_failed_payment";
const VERSION = "1.0";

export class SubscriptionCanceledAfterFailedPaymentDetector implements IDetector {
  readonly detectorKey = DETECTOR_KEY;
  readonly detectorVersion = VERSION;

  async evaluate(ctx: DetectorContext): Promise<DetectionResult> {
    const paymentFailed = ctx.signals.filter((s) => s.signal_key === "payment_failed");
    const subscriptionCanceled = ctx.signals.filter((s) => s.signal_key === "subscription_canceled");
    if (paymentFailed.length === 0 || subscriptionCanceled.length === 0) return noFinding("none", "none");

    const lookbackHours = (ctx.detectorDefinition.evaluation_window_json as { lookback_hours?: number }).lookback_hours ?? 168;

    for (const canceled of subscriptionCanceled) {
      const subId = (canceled.references_json as Record<string, string>)?.subscription_id ?? canceled.source_ref ?? canceled.id;
      const canceledTime = new Date(canceled.signal_time).getTime();

      const matchingFailures = paymentFailed.filter((pf) => {
        const pfSubId = (pf.references_json as Record<string, string>)?.subscription_id ?? pf.source_ref;
        if (pfSubId !== subId) return false;
        const pfTime = new Date(pf.signal_time).getTime();
        return canceledTime - pfTime <= lookbackHours * 60 * 60 * 1000 && pfTime < canceledTime;
      });
      if (matchingFailures.length === 0) continue;

      const dedupeKey = `sub_canceled_after_fail:${subId}`;
      const groupingKey = `subscription:${subId}`;
      return actionableFinding(dedupeKey, groupingKey, dedupeKey, 0.9, {
        headline: "Subscription canceled after payment distress",
        detector_reason: "Same subscription experienced payment failure then cancellation within lookback.",
        why_now: "Payment distress followed by churn indicates preventable loss.",
        entities: canceled.primary_canonical_entity_id ? [{ entityType: "subscription", entityId: canceled.primary_canonical_entity_id }] : [],
        signal_references: [
          ...matchingFailures.slice(0, 3).map((s) => ({ signalId: s.id, signalKey: s.signal_key, signalTime: s.signal_time })),
          { signalId: canceled.id, signalKey: canceled.signal_key, signalTime: canceled.signal_time },
        ],
        timeline: [
          { event: "payment_failed", timestamp: matchingFailures[0]!.signal_time },
          { event: "subscription_canceled", timestamp: canceled.signal_time },
        ],
        thresholds_crossed: [{ threshold: "lookback_hours", value: lookbackHours }],
      });
    }
    return noFinding("none", "none");
  }
}
