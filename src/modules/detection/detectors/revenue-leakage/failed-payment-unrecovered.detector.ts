/**
 * Phase 4 — Detector A1: Failed payment not recovered (§15.1).
 */
import type { IDetector } from "../base/detector.interface";
import type { DetectorContext } from "../base/detector-context";
import type { DetectionResult } from "../../domain/detection-result";
import { actionableFinding, noFinding } from "../base/detector-result";

const DETECTOR_KEY = "revenue.failed_payment_unrecovered";
const VERSION = "1.0";

export class FailedPaymentUnrecoveredDetector implements IDetector {
  readonly detectorKey = DETECTOR_KEY;
  readonly detectorVersion = VERSION;

  async evaluate(ctx: DetectorContext): Promise<DetectionResult> {
    const paymentFailed = ctx.signals.filter((s) => s.signal_key === "payment_failed");
    if (paymentFailed.length === 0) return noFinding("none", "none");

    const recoveryHours = (ctx.detectorDefinition.evaluation_window_json as { recovery_hours?: number }).recovery_hours ?? 24;
    const thresholdOverrides = ctx.detectorConfig?.threshold_overrides_json as { recovery_hours?: number } | undefined;
    const hours = thresholdOverrides?.recovery_hours ?? recoveryHours;

    for (const sig of paymentFailed) {
      const refs = (sig.references_json ?? {}) as Record<string, string>;
      const invoiceId = refs.invoice_id ?? refs.subscription_id ?? sig.source_ref ?? sig.id;
      const signalTime = new Date(sig.signal_time).getTime();
      const cutoff = Date.now() - hours * 60 * 60 * 1000;

      const hasRecovery = ctx.signals.some(
        (s) =>
          (s.signal_key === "invoice_paid" || s.signal_key === "subscription_canceled") &&
          (s.references_json as Record<string, string>)?.invoice_id === invoiceId &&
          new Date(s.signal_time).getTime() > signalTime
      );
      if (hasRecovery) continue;

      if (signalTime < cutoff) {
        const amount = (sig.measures_json as Record<string, number>)?.amount ?? 0;
        const dedupeKey = `payment_failed:${invoiceId}:${Math.floor(signalTime / 3600000)}`;
        const groupingKey = `invoice:${invoiceId}`;
        return actionableFinding(
          dedupeKey,
          groupingKey,
          dedupeKey,
          0.85,
          {
            headline: `Payment failed and unrecovered for ${hours}h`,
            detector_reason: "No recovery or payment success signal within window.",
            why_now: `Failure occurred ${Math.round((Date.now() - signalTime) / 3600000)}h ago with no recovery.`,
            entities: sig.primary_canonical_entity_id
              ? [{ entityType: "payment", entityId: sig.primary_canonical_entity_id }]
              : [],
            signal_references: [{ signalId: sig.id, signalKey: sig.signal_key, signalTime: sig.signal_time }],
            timeline: [{ event: "payment_failed", timestamp: sig.signal_time, detail: `Amount: ${amount}` }],
            thresholds_crossed: [{ threshold: "recovery_hours", value: hours, limit: hours }],
          },
          amount >= 1000 ? "high" : "medium"
        );
      }
    }
    return noFinding("none", "none");
  }
}
