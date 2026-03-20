/**
 * Phase 2 — Review queue: accept/reject match candidates (§14.4).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { getMatchCandidateById, updateMatchCandidateReview } from "../repositories/matchCandidateRepository";
import { insertEntityLink } from "../repositories/entityLinkRepository";
import { insertCanonicalEntity } from "../repositories/canonicalEntityRepository";
import { insertResolutionEvent } from "../repositories/resolutionEventRepository";
import type { CanonicalEntityType } from "../types";

export type ReviewDecision = "accept_existing" | "create_new" | "reject";

export async function reviewMatchCandidate(
  supabase: SupabaseClient,
  params: {
    candidateId: string;
    decision: ReviewDecision;
    canonicalEntityId?: string | null;
    notes?: string | null;
    userId: string;
  }
): Promise<{ ok: boolean; canonicalEntityId?: string | null; error?: string }> {
  const { data: candidate, error: fetchErr } = await getMatchCandidateById(supabase, params.candidateId);
  if (fetchErr || !candidate) return { ok: false, error: "Candidate not found" };

  if (candidate.review_status !== "pending") {
    return { ok: false, error: "Candidate already reviewed" };
  }

  const orgId = candidate.org_id;

  if (params.decision === "reject") {
    await updateMatchCandidateReview(supabase, params.candidateId, {
      review_status: "rejected",
      reviewed_by: params.userId,
      reviewed_at: new Date().toISOString(),
      review_notes: params.notes ?? null,
    });
    await insertResolutionEvent(supabase, {
      org_id: orgId,
      event_type: "candidate_rejected",
      canonical_entity_id: null,
      related_entity_id: null,
      link_id: null,
      candidate_id: params.candidateId,
      actor_type: "user",
      actor_ref: params.userId,
      event_payload_json: { notes: params.notes ?? null },
    });
    return { ok: true };
  }

  if (params.decision === "accept_existing" && params.canonicalEntityId) {
    const { data: link, error: linkErr } = await insertEntityLink(supabase, {
      org_id: orgId,
      canonical_entity_id: params.canonicalEntityId,
      provider: candidate.primary_provider,
      integration_account_id: null,
      external_object_type: candidate.primary_object_type,
      external_id: candidate.primary_external_id,
      external_key: null,
      link_status: "linked",
      confidence_score: candidate.confidence_score,
      match_strategy: "manual_override",
      match_reasons_json: ["Accepted from review queue"],
      linked_by_type: "user",
      linked_by_ref: params.userId,
      unlinked_at: null,
    });
    if (linkErr) return { ok: false, error: linkErr.message };
    await updateMatchCandidateReview(supabase, params.candidateId, {
      review_status: "accepted",
      reviewed_by: params.userId,
      reviewed_at: new Date().toISOString(),
      review_notes: params.notes ?? null,
      proposed_canonical_entity_id: params.canonicalEntityId,
    });
    await insertResolutionEvent(supabase, {
      org_id: orgId,
      event_type: "candidate_accepted",
      canonical_entity_id: params.canonicalEntityId,
      related_entity_id: null,
      candidate_id: params.candidateId,
      link_id: link?.id ?? null,
      actor_type: "user",
      actor_ref: params.userId,
      event_payload_json: { notes: params.notes ?? null },
    });
    return { ok: true, canonicalEntityId: params.canonicalEntityId };
  }

  if (params.decision === "create_new") {
    const { data: newEntity, error: createErr } = await insertCanonicalEntity(supabase, {
      org_id: orgId,
      entity_type: candidate.proposed_entity_type as CanonicalEntityType,
      display_name: candidate.primary_external_id,
      canonical_key: null,
      preferred_attributes_json: {},
      source_summary_json: {
        provider: candidate.primary_provider,
        objectType: candidate.primary_object_type,
        externalId: candidate.primary_external_id,
      },
      status: "active",
      merge_parent_id: null,
      created_by_type: "user",
      created_by_ref: params.userId,
      archived_at: null,
    });
    if (createErr || !newEntity) return { ok: false, error: createErr?.message ?? "Failed to create entity" };
    await insertEntityLink(supabase, {
      org_id: orgId,
      canonical_entity_id: newEntity.id,
      provider: candidate.primary_provider,
      integration_account_id: null,
      external_object_type: candidate.primary_object_type,
      external_id: candidate.primary_external_id,
      external_key: null,
      link_status: "linked",
      confidence_score: 1,
      match_strategy: "manual_override",
      match_reasons_json: ["New entity created from review"],
      linked_by_type: "user",
      linked_by_ref: params.userId,
      unlinked_at: null,
    });
    await updateMatchCandidateReview(supabase, params.candidateId, {
      review_status: "accepted",
      reviewed_by: params.userId,
      reviewed_at: new Date().toISOString(),
      review_notes: params.notes ?? null,
      proposed_canonical_entity_id: newEntity.id,
    });
    await insertResolutionEvent(supabase, {
      org_id: orgId,
      event_type: "candidate_accepted_new_entity",
      canonical_entity_id: newEntity.id,
      related_entity_id: null,
      link_id: null,
      candidate_id: params.candidateId,
      actor_type: "user",
      actor_ref: params.userId,
      event_payload_json: { notes: params.notes ?? null },
    });
    return { ok: true, canonicalEntityId: newEntity.id };
  }

  return { ok: false, error: "Invalid decision or missing canonicalEntityId" };
}
