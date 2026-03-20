/**
 * Phase 4 — Detector A4: Payment failure spike (§15.1).
 */
import type { IDetector } from "../base/detector.interface";
import type { DetectorContext } from "../base/detector-context";
import type { DetectionResult } from "../../domain/detection-result";
import { actionableFinding, noFinding } from "../base/detector-result";

const DETECTOR_KEY = "revenue.payment_failure_spike";
const VERSION = "1.0";

export class PaymentFailureSpikeDetector implements IDetector {
  readonly detectorKey = DETECTOR_KEY;
  readonly detectorVersion = VERSION;

  async evaluate(ctx: DetectorContext): Promise<DetectionResult> {
    const paymentFailed = ctx.signals.filter((s) => s.signal_key === "payment_failed");
    if (paymentFailed.length < 3) return noFinding("none", "none");

    const defaults = ctx.detectorDefinition.threshold_defaults_json as { min_count?: number; min_amount?: number };
    const overrides = ctx.detectorConfig?.threshold_overrides_json as { min_count?: number } | undefined;
    const minCount = overrides?.min_count ?? defaults?.min_count ?? 5;

    if (paymentFailed.length < minCount) return noFinding("none", "none");

    const totalAmount = paymentFailed.reduce(
      (sum, s) => sum + ((s.measures_json as Record<string, number>)?.amount ?? 0),
      0
    );

    const dedupeKey = `payment_spike:${Math.floor(Date.now() / 3600000)}`;
    const groupingKey = "org";
    return actionableFinding(dedupeKey, groupingKey, dedupeKey, 0.85, {
      headline: `Payment failure spike: ${paymentFailed.length} failures ($${totalAmount.toFixed(0)})`,
      detector_reason: "Failure count exceeds baseline threshold in rolling window.",
      why_now: "Spike indicates possible systemic billing or card issue.",
      signal_references: paymentFailed.slice(0, 5).map((s) => ({ signalId: s.id, signalKey: s.signal_key, signalTime: s.signal_time })),
      timeline: paymentFailed.slice(0, 5).map((s) => ({
        event: "payment_failed",
        timestamp: s.signal_time,
        detail: `$${(s.measures_json as Record<string, number>)?.amount ?? 0}`,
      })),
      thresholds_crossed: [{ threshold: "min_count", value: paymentFailed.length, limit: minCount }],
      supporting_metrics: { count: paymentFailed.length, totalAmount },
    });
  }
}
