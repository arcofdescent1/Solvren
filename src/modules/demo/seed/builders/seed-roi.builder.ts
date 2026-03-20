/**
 * Phase 8 — ROI / Outcomes seed builder.
 */
import { ts, seededUuid } from "./seed-helpers";

type OutcomeInsert = Record<string, unknown>;

export type SeedOutcomeInput = {
  orgId: string;
  issueId: string;
  actionId?: string | null;
  outcomeType: "recovered_revenue" | "avoided_loss" | "operational_savings";
  amount: number;
  daysAgo?: number;
};

export function buildSeedOutcomes(input: SeedOutcomeInput[]): OutcomeInsert[] {
  return input.map((o, idx) => {
    const daysAgo = o.daysAgo ?? 1;
    const outcomeId = seededUuid(`outcome:${o.orgId}:${o.issueId}:${o.outcomeType}:${idx}`);

    return {
      id: outcomeId,
      org_id: o.orgId,
      issue_id: o.issueId,
      action_id: o.actionId ?? null,
      outcome_type: o.outcomeType,
      amount: o.amount,
      currency: "USD",
      verification_type: "direct",
      confidence_score: 1.0,
      evidence_json: { demo: true } as unknown as Record<string, unknown>,
      created_at: ts(-daysAgo),
    } as OutcomeInsert;
  });
}
