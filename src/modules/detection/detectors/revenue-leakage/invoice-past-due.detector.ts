/**
 * Phase 4 — Detector A2: Invoice past due above threshold (§15.1).
 */
import type { IDetector } from "../base/detector.interface";
import type { DetectorContext } from "../base/detector-context";
import type { DetectionResult } from "../../domain/detection-result";
import { actionableFinding, noFinding } from "../base/detector-result";

const DETECTOR_KEY = "revenue.invoice_past_due_high_value";
const VERSION = "1.0";

export class InvoicePastDueDetector implements IDetector {
  readonly detectorKey = DETECTOR_KEY;
  readonly detectorVersion = VERSION;

  async evaluate(ctx: DetectorContext): Promise<DetectionResult> {
    const pastDue = ctx.signals.filter((s) => s.signal_key === "invoice_past_due");
    if (pastDue.length === 0) return noFinding("none", "none");

    const defaults = ctx.detectorDefinition.threshold_defaults_json as { min_amount?: number };
    const overrides = ctx.detectorConfig?.threshold_overrides_json as { min_amount?: number } | undefined;
    const minAmount = overrides?.min_amount ?? defaults?.min_amount ?? 1000;

    const window = ctx.detectorDefinition.evaluation_window_json as { past_due_days?: number };
    const pastDueDays = window.past_due_days ?? 7;

    for (const sig of pastDue) {
      const amount = (sig.measures_json as Record<string, number>)?.amount_due ?? 0;
      if (amount < minAmount) continue;

      const refs = (sig.references_json ?? {}) as Record<string, string>;
      const invoiceId = refs.subscription_id ?? sig.source_ref ?? sig.id;
      const signalTime = new Date(sig.signal_time).getTime();
      const ageDays = (Date.now() - signalTime) / (24 * 60 * 60 * 1000);
      if (ageDays < pastDueDays) continue;

      const dedupeKey = `invoice_past_due:${invoiceId}`;
      const groupingKey = `invoice:${invoiceId}`;
      return actionableFinding(
        dedupeKey,
        groupingKey,
        dedupeKey,
        0.9,
        {
          headline: `Invoice past due ${Math.round(ageDays)} days ($${amount})`,
          detector_reason: "High-value invoice remains past due beyond threshold.",
          why_now: `Invoice has been overdue for ${Math.round(ageDays)} days.`,
          entities: sig.primary_canonical_entity_id
            ? [{ entityType: "invoice", entityId: sig.primary_canonical_entity_id }]
            : [],
          signal_references: [{ signalId: sig.id, signalKey: sig.signal_key, signalTime: sig.signal_time }],
          timeline: [{ event: "invoice_past_due", timestamp: sig.signal_time, detail: `Amount: $${amount}` }],
          thresholds_crossed: [
            { threshold: "min_amount", value: amount, limit: minAmount },
            { threshold: "past_due_days", value: ageDays, limit: pastDueDays },
          ],
        },
        "high"
      );
    }
    return noFinding("none", "none");
  }
}
