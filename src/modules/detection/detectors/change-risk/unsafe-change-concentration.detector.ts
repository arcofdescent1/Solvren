/**
 * Phase 4 — Detector D4: Unsafe change concentration (§15.4).
 */
import type { IDetector } from "../base/detector.interface";
import type { DetectorContext } from "../base/detector-context";
import type { DetectionResult } from "../../domain/detection-result";
import { actionableFinding, noFinding } from "../base/detector-result";

const DETECTOR_KEY = "change.unsafe_change_concentration";
const VERSION = "1.0";

export class UnsafeChangeConcentrationDetector implements IDetector {
  readonly detectorKey = DETECTOR_KEY;
  readonly detectorVersion = VERSION;

  async evaluate(ctx: DetectorContext): Promise<DetectionResult> {
    const deployed = ctx.signals.filter((s) => s.signal_key === "change_deployed");
    if (deployed.length < 3) return noFinding("none", "none");

    const window = ctx.detectorDefinition.evaluation_window_json as { window_hours?: number; max_in_window?: number };
    const windowHours = window.window_hours ?? 4;
    const maxInWindow = window.max_in_window ?? 3;

    const windowStart = new Date(Date.now() - windowHours * 60 * 60 * 1000).getTime();
    const inWindow = deployed.filter((s) => new Date(s.signal_time).getTime() >= windowStart);
    if (inWindow.length < maxInWindow) return noFinding("none", "none");

    const surface = (inWindow[0]?.dimensions_json as Record<string, string>)?.revenue_surface ?? "unknown";
    const dedupeKey = `unsafe_concentration:${surface}:${Math.floor(Date.now() / 3600000)}`;
    const groupingKey = `surface:${surface}`;
    return actionableFinding(dedupeKey, groupingKey, dedupeKey, 0.85, {
      headline: `${inWindow.length} high-risk changes to ${surface} in ${windowHours}h`,
      detector_reason: "Too many risky changes targeting same critical system in narrow window.",
      why_now: `Count (${inWindow.length}) exceeds safe threshold (${maxInWindow}).`,
      signal_references: inWindow.slice(0, 5).map((s) => ({ signalId: s.id, signalKey: s.signal_key, signalTime: s.signal_time })),
      timeline: inWindow.slice(0, 5).map((s) => ({ event: "change_deployed", timestamp: s.signal_time })),
      thresholds_crossed: [{ threshold: "max_in_window", value: inWindow.length, limit: maxInWindow }],
      supporting_metrics: { count: inWindow.length, surface },
    });
  }
}
