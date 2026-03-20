/**
 * Phase 1 Gap 1 — Issue linkage service (§9).
 * Links signals and entities to issues.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export type SignalLink = {
  signalId: string;
  relevanceScore?: number;
};

export type ResolvedEntity = {
  entityId: string;
  entityType: string;
  role: "primary" | "secondary" | "related" | "inferred";
  confidence: number;
  externalSystem?: string | null;
  externalId?: string | null;
  displayName?: string | null;
};

export async function linkSignals(
  supabase: SupabaseClient,
  issueId: string,
  signals: SignalLink[]
): Promise<{ linked: number; errors: string[] }> {
  const errors: string[] = [];
  let linked = 0;

  for (const s of signals) {
    const { error } = await supabase.from("issue_signal_links").insert({
      issue_id: issueId,
      signal_id: s.signalId,
      relevance_score: s.relevanceScore ?? 1.0,
    });
    if (error) {
      errors.push(`signal ${s.signalId}: ${error.message}`);
    } else {
      linked++;
    }
  }

  return { linked, errors };
}

export async function linkEntities(
  supabase: SupabaseClient,
  issueId: string,
  entities: ResolvedEntity[]
): Promise<{ linked: number; errors: string[] }> {
  const errors: string[] = [];
  let linked = 0;

  for (const e of entities) {
    const row = {
      issue_id: issueId,
      entity_type: e.entityType,
      role: e.role,
      confidence: e.confidence,
      canonical_entity_id: e.entityId,
      external_system: e.externalSystem ?? null,
      external_id: e.externalId ?? null,
      entity_display_name: e.displayName ?? null,
      metadata_json: {},
    };
    const { error } = await supabase.from("issue_entities").insert(row);
    if (error) {
      errors.push(`entity ${e.entityId}: ${error.message}`);
    } else {
      linked++;
    }
  }

  return { linked, errors };
}
