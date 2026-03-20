/**
 * Phase 2 — Entity resolution pipeline (§10.1, §14.8). Standard entry point for all ingestion.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  CanonicalEntityType,
  ResolveExternalObjectInput,
  ResolveExternalObjectResult,
} from "../types";
import { ENTITY_TYPE_POLICY } from "../constants";
import { getLinkByExternal } from "../repositories/entityLinkRepository";
import { getCanonicalEntityById } from "../repositories/canonicalEntityRepository";
import { insertCanonicalEntity } from "../repositories/canonicalEntityRepository";
import { insertEntityLink } from "../repositories/entityLinkRepository";
import { insertMatchCandidate } from "../repositories/matchCandidateRepository";
import { insertResolutionEvent } from "../repositories/resolutionEventRepository";
import { matchByExistingLink, matchPersonByExactEmail } from "./deterministicMatcher";
import { findProbabilisticCandidates } from "./probabilisticMatcher";
import { extractPrimaryEmail } from "./normalizationService";
import { getEffectiveThresholds } from "./resolutionRulesService";

const PROVIDER_TO_ENTITY_TYPE: Record<string, CanonicalEntityType> = {
  contact: "person",
  lead: "person",
  company: "company",
  account: "company",
  deal: "opportunity",
  opportunity: "opportunity",
  subscription: "subscription",
  invoice: "invoice",
  charge: "payment",
  payment_intent: "payment",
  customer: "person",
  meeting: "meeting",
  booking: "meeting",
  change: "change",
  incident: "incident",
};

function inferEntityType(provider: string, objectType: string): CanonicalEntityType {
  const key = objectType.toLowerCase().replace(/\s/g, "_");
  return PROVIDER_TO_ENTITY_TYPE[key] ?? "person";
}

export async function resolveExternalObject(
  supabase: SupabaseClient,
  input: ResolveExternalObjectInput
): Promise<ResolveExternalObjectResult> {
  const { orgId, provider, objectType, externalId, payload, integrationAccountId, observedAt } = input;
  const entityType = inferEntityType(provider, objectType);

  const existing = await matchByExistingLink(supabase, orgId, provider, objectType, externalId);
  if (existing.matched && existing.canonicalEntityId) {
    const { data: entity } = await getCanonicalEntityById(supabase, existing.canonicalEntityId);
    const resolvedType = (entity?.entity_type as CanonicalEntityType) ?? entityType;
    await insertResolutionEvent(supabase, {
      org_id: orgId,
      event_type: "existing_link_used",
      canonical_entity_id: existing.canonicalEntityId,
      related_entity_id: null,
      link_id: null,
      candidate_id: null,
      actor_type: "system",
      actor_ref: "resolveExternalObject",
      event_payload_json: { provider, objectType, externalId },
    });
    return {
      canonicalEntityId: existing.canonicalEntityId,
      entityType: resolvedType,
      resolutionOutcome: "existing_link",
      confidenceScore: existing.confidence,
      reasons: existing.reasons,
    };
  }

  let matchResult: { matched: boolean; canonicalEntityId: string | null; confidence: number; strategy: string | null; reasons: string[] } = {
    matched: false,
    canonicalEntityId: null,
    confidence: 0,
    strategy: null,
    reasons: [],
  };

  if (entityType === "person") {
    const email = extractPrimaryEmail(payload as Record<string, unknown>);
    if (email) {
      const personMatch = await matchPersonByExactEmail(supabase, orgId, email);
      if (personMatch.matched) matchResult = { ...personMatch, strategy: personMatch.strategy };
    }
  }

  if (!matchResult.matched && (entityType === "person" || entityType === "company")) {
    const probCandidates = await findProbabilisticCandidates(supabase, orgId, entityType, payload as Record<string, unknown>);
    const best = probCandidates[0];
    if (best) {
      matchResult = {
        matched: true,
        canonicalEntityId: best.canonicalEntityId,
        confidence: best.confidence,
        strategy: best.strategy,
        reasons: best.reasons,
      };
    }
  }

  const thresholds = await getEffectiveThresholds(supabase, orgId, entityType);
  const confidence = matchResult.confidence;
  const autoLink = confidence >= thresholds.autoLink;
  const reviewRange = confidence >= thresholds.reviewMin && confidence < thresholds.autoLink;

  if (matchResult.matched && matchResult.canonicalEntityId && autoLink) {
    const { data: link, error: linkErr } = await insertEntityLink(supabase, {
      org_id: orgId,
      canonical_entity_id: matchResult.canonicalEntityId,
      provider,
      integration_account_id: integrationAccountId ?? null,
      external_object_type: objectType,
      external_id: externalId,
      external_key: null,
      link_status: "linked",
      confidence_score: confidence,
      match_strategy: matchResult.strategy ?? "deterministic_external_reference",
      match_reasons_json: matchResult.reasons,
      linked_by_type: "system",
      linked_by_ref: "resolveExternalObject",
      unlinked_at: null,
    });
    if (!linkErr && link) {
      await insertResolutionEvent(supabase, {
        org_id: orgId,
        event_type: "auto_linked",
        canonical_entity_id: matchResult.canonicalEntityId,
        related_entity_id: null,
        link_id: link.id,
        candidate_id: null,
        actor_type: "system",
        actor_ref: "resolveExternalObject",
        event_payload_json: { provider, objectType, externalId, confidence },
      });
      return {
        canonicalEntityId: matchResult.canonicalEntityId,
        entityType,
        resolutionOutcome: "auto_linked",
        confidenceScore: confidence,
        reasons: matchResult.reasons,
      };
    }
  }

  if (matchResult.matched && matchResult.canonicalEntityId && reviewRange) {
    const { data: candidate } = await insertMatchCandidate(supabase, {
      org_id: orgId,
      candidate_type: "link_to_existing",
      primary_provider: provider,
      primary_object_type: objectType,
      primary_external_id: externalId,
      proposed_entity_type: entityType,
      proposed_canonical_entity_id: matchResult.canonicalEntityId,
      confidence_score: confidence,
      score_breakdown_json: {},
      reasons_json: matchResult.reasons,
      review_status: "pending",
      reviewed_by: null,
      reviewed_at: null,
      review_notes: null,
      expires_at: null,
    });
    if (candidate) {
      await insertResolutionEvent(supabase, {
        org_id: orgId,
        event_type: "candidate_created",
        canonical_entity_id: null,
        related_entity_id: null,
        link_id: null,
        candidate_id: candidate.id,
        actor_type: "system",
        actor_ref: "resolveExternalObject",
        event_payload_json: { provider, objectType, externalId, confidence },
      });
      return {
        canonicalEntityId: null,
        entityType,
        resolutionOutcome: "candidate_created",
        confidenceScore: confidence,
        reasons: matchResult.reasons,
      };
    }
  }

  const policy = ENTITY_TYPE_POLICY[entityType] ?? "create_new";
  if (policy === "create_new" || policy === "create_or_candidate") {
    const displayName = (payload as Record<string, unknown>).name ?? (payload as Record<string, unknown>).title ?? externalId;
    const { data: newEntity, error: createErr } = await insertCanonicalEntity(supabase, {
      org_id: orgId,
      entity_type: entityType,
      display_name: typeof displayName === "string" ? displayName : String(displayName),
      canonical_key: null,
      preferred_attributes_json: {},
      source_summary_json: { provider, objectType, externalId },
      status: "active",
      merge_parent_id: null,
      created_by_type: "system",
      created_by_ref: "resolveExternalObject",
      archived_at: null,
    });
    if (!createErr && newEntity) {
      await insertEntityLink(supabase, {
        org_id: orgId,
        canonical_entity_id: newEntity.id,
        provider,
        integration_account_id: integrationAccountId ?? null,
        external_object_type: objectType,
        external_id: externalId,
        external_key: null,
        link_status: "linked",
        confidence_score: 1,
        match_strategy: "backfill_import",
        match_reasons_json: ["New canonical entity created"],
        linked_by_type: "system",
        linked_by_ref: "resolveExternalObject",
        unlinked_at: null,
      });
      await insertResolutionEvent(supabase, {
        org_id: orgId,
        event_type: "entity_created",
        canonical_entity_id: newEntity.id,
        related_entity_id: null,
        link_id: null,
        candidate_id: null,
        actor_type: "system",
        actor_ref: "resolveExternalObject",
        event_payload_json: { provider, objectType, externalId },
      });
      return {
        canonicalEntityId: newEntity.id,
        entityType,
        resolutionOutcome: "created_entity",
        confidenceScore: 1,
        reasons: ["New canonical entity created"],
      };
    }
  }

  return {
    canonicalEntityId: null,
    entityType,
    resolutionOutcome: "unresolved",
    confidenceScore: confidence,
    reasons: matchResult.reasons.length ? matchResult.reasons : ["No match found"],
  };
}
