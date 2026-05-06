/**
 * Phase 3 — deterministic scoring (pure functions + unit-test surface).
 */
import { isHighImpact } from "./issueStateService";
import type { IssueWorkflowStatus } from "./issuePhase2Types";
import { normalizeIssueWorkflowStatus } from "./issuePhase2Types";

/** Canonical playbook labels (spec § actionability). */
export const PLAYBOOK_ISSUE_TYPES = new Set([
  "failed_payments",
  "duplicate_contacts",
  "no_follow_up",
  "stalled_deals",
  "high_refund_rate",
]);

/** Maps Value Engine `detection_type` keys → canonical playbook keys. */
const PLAYBOOK_DETECTION_TYPE_TO_CANONICAL: Record<string, string> = {
  stripe_failed_payments: "failed_payments",
  stripe_high_refund_rate: "high_refund_rate",
  hubspot_duplicate_contacts: "duplicate_contacts",
  hubspot_no_followup_leads: "no_follow_up",
  hubspot_stalled_deals: "stalled_deals",
};

export function canonicalPlaybookKey(detectionType: string | null | undefined): string | null {
  if (!detectionType) return null;
  const direct = PLAYBOOK_DETECTION_TYPE_TO_CANONICAL[detectionType];
  if (direct) return direct;
  const stripped = detectionType.replace(/^(stripe|hubspot|salesforce)_/i, "");
  return stripped || null;
}

export function isPlaybookIssueType(detectionType: string | null | undefined): boolean {
  const k = canonicalPlaybookKey(detectionType);
  return k != null && PLAYBOOK_ISSUE_TYPES.has(k);
}

export type ScorePart = { score: number; reason: string };

export function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

export function roundedWeightedPriority(parts: {
  impact: number;
  urgency: number;
  confidence: number;
  recurrence: number;
  actionability: number;
}): number {
  const raw =
    parts.impact * 0.4 +
    parts.urgency * 0.2 +
    parts.confidence * 0.15 +
    parts.recurrence * 0.15 +
    parts.actionability * 0.1;
  return Math.round(raw);
}

export function priorityBandFromScore(score: number): "critical" | "high" | "medium" | "low" {
  if (score >= 85) return "critical";
  if (score >= 65) return "high";
  if (score >= 40) return "medium";
  return "low";
}

/** Derive UI/API band from canonical confidence_score (never stored). */
export function deriveConfidenceBand(score: number): "high" | "medium" | "low" {
  if (score >= 80) return "high";
  if (score >= 50) return "medium";
  return "low";
}

export function calculateImpactScore(revenueImpactCents: number): ScorePart {
  const r = revenueImpactCents;
  if (r >= 5_000_000) return { score: 100, reason: "$50,000+ estimated revenue impact" };
  if (r >= 1_000_000) return { score: 80, reason: "$10,000+ estimated revenue impact" };
  if (r >= 500_000) return { score: 65, reason: "$5,000+ estimated revenue impact" };
  if (r >= 100_000) return { score: 45, reason: "$1,000+ estimated revenue impact" };
  if (r > 0) return { score: 25, reason: "Under $1,000 estimated impact" };
  return { score: 10, reason: "Impact unknown or $0" };
}

export function calculateUrgencyScore(params: {
  status: string;
  approvalState: string;
  slaDueAt: string | null;
  severity: string;
  revenueImpactCents: number;
  nowMs?: number;
}): ScorePart {
  const now = params.nowMs ?? Date.now();
  const st = normalizeIssueWorkflowStatus(params.status);
  const terminal: IssueWorkflowStatus[] = ["resolved", "verified", "dismissed"];
  if (terminal.includes(st)) {
    return { score: 0, reason: "Issue is closed or dismissed" };
  }

  if (params.slaDueAt) {
    const due = Date.parse(params.slaDueAt);
    if (due < now) return { score: 100, reason: "SLA breached" };
    if (due <= now + 24 * 3600 * 1000) return { score: 80, reason: "SLA due within 24 hours" };
  }

  if (params.approvalState === "pending") {
    return { score: 70, reason: "Approval is pending" };
  }

  if (st === "detected" && isHighImpact({ severity: params.severity, revenueImpactCents: params.revenueImpactCents })) {
    return { score: 65, reason: "High-impact detection awaiting triage" };
  }

  return { score: 40, reason: "Standard urgency" };
}

export function calculateConfidenceInputScore(params: {
  detectionConfidence: string | null | undefined;
  detectionSource: string | null | undefined;
  affectedCount: number;
  revenueImpactFallback: boolean;
}): ScorePart {
  const dc = String(params.detectionConfidence ?? "medium").toLowerCase();
  let score = dc === "high" ? 90 : dc === "low" ? 35 : 65;
  const bits: string[] = [];

  if (params.affectedCount >= 10) {
    score += 10;
    bits.push("10+ affected records");
  }
  if (String(params.detectionSource ?? "").toLowerCase() === "stripe") {
    score += 10;
    bits.push("Stripe source");
  }
  if (params.revenueImpactFallback) {
    score -= 15;
    bits.push("impact used fallback avg deal value");
  }
  if (params.affectedCount === 0) {
    score -= 20;
    bits.push("no affected count");
  }

  score = clamp(score, 0, 100);
  const reason =
    bits.length > 0
      ? `Detection confidence adjusted (${bits.join("; ")})`
      : `Detection confidence ${dc}`;

  return { score, reason };
}

export function calculateRecurrenceScore(recurrenceCount: number): ScorePart {
  const n = recurrenceCount;
  if (n >= 5) return { score: 100, reason: "This issue has recurred 5+ times" };
  if (n >= 3) return { score: 75, reason: "This issue has recurred 3+ times" };
  if (n === 2) return { score: 50, reason: "This issue has recurred twice" };
  if (n === 1) return { score: 25, reason: "This issue has recurred once" };
  return { score: 0, reason: "No recurrence recorded" };
}

export function calculateActionabilityScore(params: {
  recommendedAction: string | null | undefined;
  ownerEmail: string | null | undefined;
  detectionType: string | null | undefined;
}): ScorePart {
  const owner = Boolean(params.ownerEmail?.trim());
  const rec = Boolean(params.recommendedAction?.trim());
  const playbook = isPlaybookIssueType(params.detectionType);

  if (rec && owner) {
    return { score: 100, reason: "Recommended action available and owner assigned" };
  }
  if (rec) {
    return { score: 80, reason: "Recommended action available" };
  }
  if (playbook) {
    return { score: 60, reason: "Deterministic playbook available for this issue type" };
  }
  return { score: 30, reason: "No owner or playbook action yet" };
}

export function calculateNoiseScore(params: {
  revenueImpactCents: number;
  affectedCount: number;
  confidenceScore: number;
  hadDismissAction: boolean;
  payloadIncomplete: boolean;
  isHighImpactIssue: boolean;
}): { noiseScore: number; reasons: string[] } {
  let noise = 0;
  const reasons: string[] = [];

  if (params.revenueImpactCents === 0) {
    noise += 30;
    reasons.push("Zero revenue impact");
  }
  if (params.affectedCount <= 1) {
    noise += 20;
    reasons.push("Very few affected entities");
  }
  if (deriveConfidenceBand(params.confidenceScore) === "low") {
    noise += 20;
    reasons.push("Low confidence band");
  }
  if (params.hadDismissAction) {
    noise += 15;
    reasons.push("Previously dismissed");
  }
  if (params.payloadIncomplete) {
    noise += 10;
    reasons.push("Incomplete detection payload");
  }
  if (params.isHighImpactIssue) {
    noise -= 20;
    reasons.push("High-impact issue (noise dampened)");
  }

  return { noiseScore: clamp(noise, 0, 100), reasons };
}

export function isPayloadIncomplete(params: {
  metadata: Record<string, unknown> | null | undefined;
  description: string | null | undefined;
  affectedCount: number;
}): boolean {
  const sample = params.metadata?.sampleRecords;
  const hasSample = Array.isArray(sample) && sample.length > 0;
  const desc = String(params.description ?? "").trim();
  if (!hasSample) return true;
  if (!desc) return true;
  if (params.affectedCount === 0) return true;
  return false;
}

export function shouldAutoSuppress(params: {
  noiseScore: number;
  revenueImpactCents: number;
}): boolean {
  return params.noiseScore >= 70 && params.revenueImpactCents < 100_000;
}

export function generateIntelligenceSummary(args: {
  title: string;
  priorityBand: string;
  impactPhrase: string;
  urgencyPhrase: string;
  confidencePhrase: string;
}): string {
  const t = args.title || "This issue";
  return `${t} is ranked ${args.priorityBand} because it has ${args.impactPhrase}, ${args.urgencyPhrase}, and ${args.confidencePhrase}.`;
}
